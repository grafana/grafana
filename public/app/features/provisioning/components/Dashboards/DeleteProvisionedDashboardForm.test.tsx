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
    it('deletes via /files when targeting a new branch', async () => {
      let capturedRequest: { url: URL } | null = null;

      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, ({ request }) => {
          capturedRequest = { url: new URL(request.url) };
          return HttpResponse.json({
            ref: 'feature/delete',
            path: 'dashboards/test.json',
            urls: { newPullRequestURL: 'https://github.com/test/repo/compare/main...delete-branch' },
            resource: {
              upsert: {
                apiVersion: 'v1',
                kind: 'Dashboard',
                metadata: { name: 'test-uid', uid: 'test-uid' },
                spec: { title: 'Test Dashboard' },
              },
            },
          });
        })
      );

      const { user, props } = setup();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      expect(capturedRequest!.url.pathname).toContain('/repositories/test-repo/files/dashboards/test.json');
      expect(capturedRequest!.url.searchParams.get('ref')).toBe('feature/delete');
      expect(capturedRequest!.url.searchParams.get('message')).toBe('Delete dashboard: Test Dashboard');

      // Branch success redirects to the dashboard list with the PR link and dismisses the drawer
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/dashboards?new_pull_request_url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo%2Fcompare%2Fmain...delete-branch&repo_type=github&action=delete'
        );
      });
      expect(props.onDismiss).toHaveBeenCalled();
    });

    it('renders the message from the repo commit template when comment is empty', async () => {
      let capturedRequest: { url: URL } | null = null;
      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, ({ request }) => {
          capturedRequest = { url: new URL(request.url) };
          return HttpResponse.json({ resource: {} });
        })
      );

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

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });
      expect(capturedRequest!.url.searchParams.get('message')).toBe('chore(dashboards): delete Test Dashboard');
    });

    it('should handle missing repository name', async () => {
      const { user } = setup({
        defaultValues: {
          repo: '',
          ref: 'main',
          path: 'dashboards/test.json',
          comment: '',
          title: 'Test Dashboard',
          description: 'Test Description',
          folder: { uid: 'test-folder', title: 'Test Folder' },
        },
        repository: undefined,
      });

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Missing required repository for deletion');
      });
    });

    it('runs a delete job against an existing branch', async () => {
      let jobBody: { delete?: { ref?: string } } | null = null;
      let filesDeleteHit = false;
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
          jobBody = (await request.json()) as { delete?: { ref?: string } };
          return HttpResponse.json(createJob());
        }),
        http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [createJob()], metadata: { resourceVersion: '1' } })),
        http.delete(`${BASE}/repositories/:name/files/*`, () => {
          filesDeleteHit = true;
          return HttpResponse.json({ resource: {} });
        })
      );

      const { user } = setup({
        defaultValues: {
          repo: 'test-repo',
          ref: 'develop',
          path: 'dashboards/test.json',
          comment: '',
          title: 'Test Dashboard',
          description: 'Test Description',
          folder: { uid: 'test-folder', title: 'Test Folder' },
        },
      });

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => expect(jobBody).not.toBeNull());
      expect(jobBody!.delete?.ref).toBe('develop');
      expect(filesDeleteHit).toBe(false);
    });

    it('runs a delete job with no ref against the configured branch', async () => {
      let jobBody: { delete?: { ref?: string } } | null = null;
      let filesDeleteHit = false;
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
          jobBody = (await request.json()) as { delete?: { ref?: string } };
          return HttpResponse.json(createJob());
        }),
        http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [createJob()], metadata: { resourceVersion: '1' } })),
        http.delete(`${BASE}/repositories/:name/files/*`, () => {
          filesDeleteHit = true;
          return HttpResponse.json({ resource: {} });
        })
      );

      const { user } = setup({
        defaultValues: {
          repo: 'test-repo',
          ref: 'main',
          path: 'dashboards/test.json',
          comment: '',
          title: 'Test Dashboard',
          description: 'Test Description',
          folder: { uid: 'test-folder', title: 'Test Folder' },
        },
      });

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => expect(jobBody).not.toBeNull());
      expect(jobBody!.delete?.ref).toBeUndefined();
      expect(filesDeleteHit).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should display error alert when delete request fails', async () => {
      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, () => {
          return HttpResponse.json({ message: 'Something went wrong' }, { status: 500 });
        })
      );

      const { user } = setup();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should display branch-not-found message for 404 errors', async () => {
      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, () => {
          return HttpResponse.json({ message: 'file not found' }, { status: 404 });
        })
      );

      const { user } = setup();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await waitFor(() => expect(deleteButton).toBeEnabled());
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'You have selected a branch that does not contain this resource'
        );
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
