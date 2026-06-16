import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor, act } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
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

const FOLDER_BY_NAME = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:folderUid';

// Default movable-file response (the provisioning files GET defaults to 404).
function fileResponse(sourcePath = 'folder1/dashboard.json') {
  return {
    resource: {
      file: { spec: { title: 'Test Dashboard' } },
      dryRun: {
        metadata: {
          annotations: { [AnnoKeySourcePath]: sourcePath },
        },
      },
    },
  };
}

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
      workflow: 'write',
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
      target: 'folder',
    },
    canPushToConfiguredBranch: true,
    targetFolderUID: 'target-folder-uid',
    targetFolderTitle: 'Target Folder',
    onDismiss: jest.fn(),
    onSuccess: jest.fn(),
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
  workflow: 'branch',
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

    // Defaults: a movable file in folder1 and a distinct target folder, so most
    // tests render with the move button enabled and the "already in target" guard clear.
    server.use(
      http.get(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(fileResponse())),
      http.get(FOLDER_BY_NAME, () => HttpResponse.json(folderResponse('target-folder')))
    );
  });

  it('should render the form with correct title and subtitle', () => {
    setup();

    expect(screen.getByText('Move Provisioned Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should render form even when currentFileData is not available', async () => {
    server.use(http.get(`${BASE}/repositories/:name/files/*`, () => new HttpResponse(null, { status: 404 })));

    setup();

    // Form should still render, but move button should be disabled
    expect(screen.getByText('Move Provisioned Dashboard')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /move dashboard/i })).toBeDisabled();
    });
  });

  it('should show loading spinner when file data is loading', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/*`, async () => {
        await delay('infinite');
        return HttpResponse.json(fileResponse());
      })
    );

    setup();

    expect(await screen.findByText('Loading dashboard data')).toBeInTheDocument();
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

  it('should show error alert when file data has errors', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/*`, () =>
        HttpResponse.json({ errors: ['File not found', 'Permission denied'], resource: null })
      )
    );

    setup();

    expect(await screen.findByText('Error loading dashboard')).toBeInTheDocument();
    expect(screen.getByText('File not found')).toBeInTheDocument();
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  it('should disable move button when form is submitting', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async () => {
        await delay('infinite');
        return HttpResponse.json({ resource: {} });
      })
    );

    const { user } = setup({ defaultValues: branchDefaultValues });

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      const moveButton = screen.getByRole('button', { name: /moving/i });
      expect(moveButton).toBeDisabled();
      expect(moveButton).toHaveTextContent('Moving...');
    });
  });

  it('should show move dashboard button when not loading', async () => {
    setup();

    expect(await screen.findByRole('button', { name: /move dashboard/i })).toBeInTheDocument();
  });

  it('should call onDismiss when cancel button is clicked', async () => {
    const { user, props } = setup();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('does not submit a move job when the dashboard is already at the target path', async () => {
    let jobPosted = false;
    // Target folder resolves to the same folder the dashboard already lives in.
    server.use(
      http.get(FOLDER_BY_NAME, () => HttpResponse.json(folderResponse('folder1'))),
      http.post(`${BASE}/repositories/:name/jobs`, () => {
        jobPosted = true;
        return HttpResponse.json(createJob({ status: { state: 'pending' } }));
      })
    );

    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(getAppEvents().publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Failed to move dashboard', 'Dashboard is already in the selected folder.'],
      });
    });
    expect(jobPosted).toBe(false);
  });

  it('renders the message from the repo commit template when comment is empty', async () => {
    let capturedMessage: string | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, ({ request }) => {
        capturedMessage = new URL(request.url).searchParams.get('message');
        return HttpResponse.json({ resource: {} });
      })
    );

    const { user } = setup({
      defaultValues: branchDefaultValues,
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
      },
    });

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(capturedMessage).toBe('chore(dashboards): move Test Dashboard');
    });
  });

  it('navigates to the PR redirect URL and dismisses the drawer on branch workflow success', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, () =>
        HttpResponse.json({
          ref: 'feature/move',
          path: 'target-folder/dashboard.json',
          urls: { newPullRequestURL: 'https://github.com/test/repo/compare/main...feature/move' },
          resource: {
            upsert: {
              apiVersion: 'v1',
              kind: 'Dashboard',
              metadata: { name: 'dashboard-uid', uid: 'dashboard-uid' },
              spec: { title: 'Test Dashboard' },
            },
          },
        })
      )
    );

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboards?new_pull_request_url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo%2Fcompare%2Fmain...feature%2Fmove&repo_type=github'
      );
    });
    expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('publishes a single error alert when the branch workflow move fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, () =>
        HttpResponse.json({ message: 'merge conflict' }, { status: 500 })
      )
    );

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(getAppEvents().publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Failed to move dashboard', expect.anything()],
      });
    });
    // The hook-level onError handler was removed — the form's own catch is the only error surface
    expect(getAppEvents().publish).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('navigates to /dashboards when the write workflow job completes via a watch event', async () => {
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

    await user.click(await screen.findByRole('button', { name: /move dashboard/i }));

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
