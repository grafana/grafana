import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { setupProvisioningMswServer } from '../../mocks/server';

import { DeleteProvisionedDashboardForm, type Props } from './DeleteProvisionedDashboardForm';

setupProvisioningMswServer();

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => jest.fn(),
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
      ref: 'main',
      workflow: 'branch' as const,
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
    it('should successfully delete dashboard with branch workflow', async () => {
      let capturedRequest: { url: URL } | null = null;

      server.use(
        http.delete(`${BASE}/repositories/:name/files/*`, ({ request }) => {
          capturedRequest = { url: new URL(request.url) };
          return HttpResponse.json({ resource: {} });
        })
      );

      const { user } = setup();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      expect(capturedRequest!.url.pathname).toContain('/repositories/test-repo/files/dashboards/test.json');
      expect(capturedRequest!.url.searchParams.get('ref')).toBe('main');
      expect(capturedRequest!.url.searchParams.get('message')).toBe('Delete dashboard: Test Dashboard');
    });

    it('should handle missing repository name', async () => {
      const { user } = setup({
        defaultValues: {
          repo: '',
          ref: 'main',
          workflow: 'branch' as const,
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
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'You have selected a branch that does not contain this dashboard'
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
