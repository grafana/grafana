import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { createJob } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';

import { DeleteProvisionedDashboardForm, type Props } from './DeleteProvisionedDashboardForm';

setupProvisioningMswServer();

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: ({ disabled }: { disabled: boolean }) => (
    <textarea data-testid="shared-fields" disabled={disabled} />
  ),
}));

type DeleteJobBody = { message?: string; delete?: { ref?: string; paths?: string[] } };

/** Captures the posted delete job and answers the job watch with `job`. */
function mockDeleteJob(job = createJob()) {
  const posted: { body: DeleteJobBody | null } = { body: null };
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
      posted.body = (await request.json()) as DeleteJobBody;
      return HttpResponse.json(job);
    }),
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [job], metadata: { resourceVersion: '1' } }))
  );
  return posted;
}

function setup(props: Partial<Props> = {}) {
  const defaultDashboard = new DashboardScene({
    title: 'Test Dashboard',
    uid: 'test-uid',
    meta: { slug: 'test-slug' },
  });

  const defaultProps: Props = {
    dashboard: defaultDashboard,
    canPushToConfiguredBranch: true,
    readOnly: false,
    isNew: false,
    onDismiss: jest.fn(),
    defaultValues: {
      repo: 'test-repo',
      ref: 'feature/delete',
      path: 'dashboards/test.json',
      comment: '',
      title: 'Test Dashboard',
      description: 'Test Description',
      folder: { uid: 'test-folder', title: 'Test Folder' },
    },
    repository: {
      name: 'test-repo',
      target: 'folder' as const,
      title: 'Test Repository',
      type: 'github' as const,
      workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
      branch: 'main',
    },
    ...props,
  };

  return {
    props: defaultProps,
    ...render(<DeleteProvisionedDashboardForm {...defaultProps} />),
  };
}

function withRef(ref: string): Pick<Props, 'defaultValues'> {
  return {
    defaultValues: {
      repo: 'test-repo',
      ref,
      path: 'dashboards/test.json',
      comment: '',
      title: 'Test Dashboard',
      description: 'Test Description',
      folder: { uid: 'test-folder', title: 'Test Folder' },
    },
  };
}

describe('DeleteProvisionedDashboardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the drawer with correct title and subtitle', () => {
      setup();

      expect(screen.getByRole('heading', { name: 'Delete Provisioned Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    it('should render shared form fields correctly', () => {
      setup();

      expect(screen.getByTestId('shared-fields')).toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      setup();

      expect(screen.getByRole('button', { name: /delete dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it.each([
      ['the configured branch', 'main', undefined],
      ['another branch', 'feature/delete', 'feature/delete'],
    ])('runs a delete job targeting %s', async (_label, ref, expectedRef) => {
      const posted = mockDeleteJob();
      const { user } = setup(withRef(ref));

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => expect(posted.body).not.toBeNull());
      expect(posted.body!.delete?.ref).toBe(expectedRef);
      // The form knows the file path, so the job must not resolve it through the live Grafana object
      expect(posted.body!.delete?.paths).toEqual(['dashboards/test.json']);
      expect(posted.body!.message).toBe('Delete dashboard: Test Dashboard');
    });

    it('redirects to the dashboard list with the PR link once a branch delete job finishes', async () => {
      mockDeleteJob(
        createJob({
          status: {
            state: 'success',
            url: { newPullRequestURL: 'https://github.com/test/repo/compare/main...feature/delete' },
          },
        })
      );
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/dashboards?new_pull_request_url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo%2Fcompare%2Fmain...feature%2Fdelete&repo_type=github&action=delete'
        );
      });
    });

    it('redirects to the dashboard list once a configured-branch delete job finishes', async () => {
      mockDeleteJob(createJob({ status: { state: 'success' } }));
      server.use(
        // The finished job view links back to the repository, which it looks up by the job's label
        http.get(`${BASE}/repositories/:name`, ({ params }) =>
          HttpResponse.json({ metadata: { name: params.name }, spec: { type: 'github', github: {} }, status: {} })
        )
      );
      const { user } = setup(withRef('main'));

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboards'));
    });

    it('renders the message from the repo commit template when comment is empty', async () => {
      const posted = mockDeleteJob();
      const { user } = setup({
        repository: {
          name: 'test-repo',
          target: 'folder' as const,
          title: 'Test Repository',
          type: 'github' as const,
          workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
          branch: 'main',
          commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
        },
      });

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => expect(posted.body).not.toBeNull());
      expect(posted.body!.message).toBe('chore(dashboards): delete Test Dashboard');
    });

    it('should handle missing repository name', async () => {
      const { user } = setup({ ...withRef('main'), repository: undefined });

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Missing required repository for deletion');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error alert when the job cannot be created', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, () =>
          HttpResponse.json({ message: 'Something went wrong' }, { status: 500 })
        )
      );

      const { user } = setup();

      await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
      });
    });
  });

  describe('Read-only State', () => {
    it('should disable delete button when read-only', () => {
      setup({ readOnly: true });

      expect(screen.getByRole('button', { name: /delete dashboard/i })).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should call onDismiss when cancel button is clicked', async () => {
      const { user, props } = setup();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(props.onDismiss).toHaveBeenCalled();
    });
  });
});
