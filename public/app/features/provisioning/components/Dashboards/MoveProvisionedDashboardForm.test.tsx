import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor, act } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { FOLDER_BY_NAME_URL, PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { createJob } from '../../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../../mocks/server';

import { MoveProvisionedDashboardForm, type Props } from './MoveProvisionedDashboardForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
  };
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="resource-edit-form" />,
}));

// Folder GET-by-name response carrying the sourcePath annotation the path calc reads.
function folderResponse(sourcePath: string) {
  return {
    kind: 'Folder',
    apiVersion: 'folder.grafana.app/v1beta1',
    metadata: {
      name: 'target-folder-uid',
      annotations: { [AnnoKeySourcePath]: sourcePath },
    },
    spec: { title: 'Target Folder' },
  };
}

type MoveJobBody = {
  message?: string;
  move?: { ref?: string; targetPath?: string; resources?: Array<{ name: string; group: string; kind: string }> };
};

/** Captures the posted move job and answers the job watch with `job`. */
function mockMoveJob(job = createJob()) {
  const posted: { body: MoveJobBody | null } = { body: null };
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
      posted.body = (await request.json()) as MoveJobBody;
      return HttpResponse.json(job);
    }),
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [job], metadata: { resourceVersion: '1' } }))
  );
  return posted;
}

function setup(props: Partial<Props> = {}) {
  const mockDashboard = {
    useState: jest.fn().mockReturnValue({
      editPanel: null,
    }),
    setState: jest.fn(),
    state: {
      title: 'Test Dashboard',
      meta: {
        uid: 'dashboard-uid',
      },
    },
  } as unknown as DashboardScene;

  const defaultProps: Props = {
    dashboard: mockDashboard,
    defaultValues: {
      repo: 'test-repo',
      path: 'folder1/dashboard.json',
      ref: 'main',
      comment: '',
      title: 'Test Dashboard',
      description: '',
      folder: { uid: '', title: '' },
    },
    readOnly: false,
    repository: {
      type: 'github',
      name: 'test-repo',
      title: 'Test Repo',
      workflows: ['branch', 'write'],
      branch: 'main',
      target: 'folder',
    },
    canPushToConfiguredBranch: true,
    targetFolderUID: 'target-folder-uid',
    onDismiss: jest.fn(),
    ...props,
  };

  return {
    ...render(<MoveProvisionedDashboardForm {...defaultProps} />),
    props: defaultProps,
  };
}

const branchDefaultValues: Props['defaultValues'] = {
  repo: 'test-repo',
  path: 'folder1/dashboard.json',
  ref: 'feature/move',
  comment: '',
  title: 'Test Dashboard',
  description: '',
  folder: { uid: '', title: '' },
};

describe('MoveProvisionedDashboardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    // Default: a target folder distinct from the dashboard's own, so the "already in target" guard is clear.
    server.use(http.get(FOLDER_BY_NAME_URL, () => HttpResponse.json(folderResponse('target-folder'))));
  });

  it('should render the form with correct title and subtitle', () => {
    setup();

    expect(screen.getByText('Move Provisioned Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should show read-only alert when repository is read-only', () => {
    setup({ readOnly: true });

    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
    expect(screen.getByText(/This dashboard cannot be moved directly from Grafana/)).toBeInTheDocument();
  });

  it('should show target path input with calculated path', async () => {
    setup();

    expect(await screen.findByDisplayValue('target-folder/dashboard.json')).toBeInTheDocument();
  });

  it('should disable move button when form is submitting', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async () => {
        await delay('infinite');
        return HttpResponse.json(createJob());
      })
    );

    const { user } = setup({ defaultValues: branchDefaultValues });

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    const moveButton = await screen.findByRole('button', { name: /moving/i });
    expect(moveButton).toBeDisabled();
    expect(moveButton).toHaveTextContent('Moving...');
  });

  it('should call onDismiss when cancel button is clicked', async () => {
    const { user, props } = setup();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('does not submit a move job when the dashboard is already at the target path', async () => {
    // Target folder resolves to the same folder the dashboard already lives in.
    server.use(http.get(FOLDER_BY_NAME_URL, () => HttpResponse.json(folderResponse('folder1'))));
    const posted = mockMoveJob();

    const { user } = setup();

    await screen.findByDisplayValue('folder1/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(getAppEvents().publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Failed to move dashboard', 'Dashboard is already in the selected folder.'],
      });
    });
    expect(posted.body).toBeNull();
  });

  it.each([
    ['the configured branch', 'main', undefined],
    ['another branch', 'feature/move', 'feature/move'],
  ])('runs a move job into the target folder on %s', async (_label, ref, expectedRef) => {
    const posted = mockMoveJob();
    const { user } = setup({ defaultValues: { ...branchDefaultValues, ref } });

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => expect(posted.body).not.toBeNull());
    expect(posted.body!.move?.ref).toBe(expectedRef);
    expect(posted.body!.move?.targetPath).toBe('target-folder/');
    // The job names the dashboard, so authorization runs against that resource rather than its folder
    expect(posted.body!.move?.resources).toEqual([
      { name: 'dashboard-uid', group: 'dashboard.grafana.app', kind: 'Dashboard' },
    ]);
  });

  it('renders the message from the repo commit template when comment is empty', async () => {
    const posted = mockMoveJob();

    const { user } = setup({
      defaultValues: branchDefaultValues,
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        branch: 'main',
        commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
      },
    });

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => expect(posted.body).not.toBeNull());
    expect(posted.body!.message).toBe('chore(dashboards): move Test Dashboard');
  });

  it('navigates to the PR redirect URL once a branch move job finishes', async () => {
    mockMoveJob(
      createJob({
        status: {
          state: 'success',
          url: { newPullRequestURL: 'https://github.com/test/repo/compare/main...feature/move' },
        },
      })
    );

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboards?new_pull_request_url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo%2Fcompare%2Fmain...feature%2Fmove&repo_type=github'
      );
    });
    expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
  });

  it('publishes a single error alert when the move job cannot be created', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, () =>
        HttpResponse.json({ message: 'merge conflict' }, { status: 500 })
      )
    );

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(getAppEvents().publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Failed to move dashboard', 'merge conflict'],
      });
    });
    expect(getAppEvents().publish).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('navigates to /dashboards when the configured-branch job completes via a watch event', async () => {
    const pendingJob = createJob({ status: { state: 'pending' } });
    const workingJob = createJob();
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(pendingJob)),
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [workingJob], metadata: { resourceVersion: '1' } })),
      // FinishedJobStatus looks up the job's repository (by the job's repository label) to render the link
      http.get(`${BASE}/repositories/:name`, ({ params }) =>
        HttpResponse.json({
          kind: 'Repository',
          apiVersion: 'provisioning.grafana.app/v0alpha1',
          metadata: { name: params.name },
          spec: { title: 'Test Repo', type: 'github', github: { url: 'https://github.com/test/repo', branch: 'main' } },
          status: {},
        })
      )
    );

    const { user } = setup();

    await screen.findByDisplayValue('target-folder/dashboard.json');
    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    // JobStatus has mounted and is watching the job
    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', {
        type: 'MODIFIED',
        object: createJob({ status: { state: 'success' } }),
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
    });
  });
});
