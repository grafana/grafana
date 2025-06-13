import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { useDeleteRepositoryFiles } from 'app/features/provisioning/hooks/useDeleteRepositoryFiles';

import { useProvisionedDashboardData, ProvisionedDashboardData } from '../saving/provisioned/hooks';
import { DashboardScene } from '../scene/DashboardScene';

import { DeleteProvisionedDashboardDrawer, Props } from './DeleteProvisionedDashboardDrawer';

// Mock the hooks and dependencies
jest.mock('app/features/provisioning/hooks/useDeleteRepositoryFiles');
jest.mock('../saving/provisioned/hooks');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
}));
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));
// Add this variable declaration near your other mock variables
const mockNavigate = jest.fn();

// Mock the form components
jest.mock('../components/Provisioned/CommentField', () => ({
  CommentField: ({ disabled }: { disabled: boolean }) => <textarea data-testid="comment-field" disabled={disabled} />,
}));

jest.mock('../components/Provisioned/PathField', () => ({
  PathField: ({ readOnly }: { readOnly: boolean }) => <input data-testid="path-field" readOnly={readOnly} />,
}));

jest.mock('../components/Provisioned/WorkflowFields', () => ({
  WorkflowFields: ({ workflow, workflowOptions }: { workflow: string; workflowOptions: Array<{ value: string }> }) => (
    <div data-testid="workflow-fields">
      <span>Workflow: {workflow}</span>
      <span>Options: {workflowOptions.map((o) => o.value).join(',')}</span>
    </div>
  ),
}));

const mockDeleteRepoFile = jest.fn();
const mockPublish = jest.fn();
const mockUseDeleteRepositoryFiles = useDeleteRepositoryFiles as jest.MockedFunction<typeof useDeleteRepositoryFiles>;
const mockUseProvisionedDashboardData = useProvisionedDashboardData as jest.MockedFunction<
  typeof useProvisionedDashboardData
>;

// Mock request state helper
type MockRequestState = {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error;
};

const createMockRequestState = (overrides: Partial<MockRequestState> = {}): MockRequestState => ({
  isLoading: false,
  isSuccess: false,
  isError: false,
  ...overrides,
});

interface SetupOptions extends Partial<Props> {
  provisionedData?: Partial<ProvisionedDashboardData>;
  requestState?: Partial<MockRequestState>;
}

function setup(options: SetupOptions = {}) {
  const { provisionedData = {}, requestState = {}, ...props } = options;
  const user = userEvent.setup();

  const defaultDashboard = new DashboardScene({
    title: 'Test Dashboard',
    uid: 'test-uid',
    meta: { slug: 'test-slug' },
  });

  const defaultProvisionedData: ProvisionedDashboardData = {
    isReady: true,
    isLoading: false,
    setIsLoading: jest.fn(),
    defaultValues: {
      repo: 'test-repo',
      ref: 'main',
      workflow: 'branch' as const,
      path: 'dashboards/test.json',
      comment: '',
      title: 'Test Dashboard',
      description: 'Test Description',
      folder: {
        uid: 'test-folder',
        title: 'Test Folder',
      },
    },
    repository: {
      name: 'test-repo',
      target: 'folder' as const,
      title: 'Test Repository',
      type: 'github' as const,
      workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
    },
    loadedFromRef: 'main',
    readOnly: false,
    isGitHub: true,
    workflowOptions: [
      { label: 'Branch', value: 'branch' },
      { label: 'Write', value: 'write' },
    ],
    isNew: false,
    ...provisionedData,
  };

  const defaultProps: Props = {
    dashboard: defaultDashboard,
    onDismiss: jest.fn(),
    ...props,
  };

  // Set up mocks with the merged data
  mockUseProvisionedDashboardData.mockReturnValue(defaultProvisionedData);
  mockUseDeleteRepositoryFiles.mockReturnValue([
    mockDeleteRepoFile,
    createMockRequestState(requestState) as ReturnType<typeof useDeleteRepositoryFiles>[1],
  ]);

  return {
    user,
    props: defaultProps,
    defaultProvisionedData,
    ...render(<DeleteProvisionedDashboardDrawer {...defaultProps} />),
  };
}

describe('DeleteProvisionedDashboardDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getAppEvents
    (getAppEvents as jest.Mock).mockReturnValue({
      publish: mockPublish,
    });
  });

  describe('Rendering', () => {
    it('should render the drawer with correct title and subtitle', () => {
      setup();

      expect(screen.getByText('Delete Provisioned Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    it('should return null when defaultValues are not provided', () => {
      const { container } = setup({
        provisionedData: {
          defaultValues: null,
        },
      });

      expect(container.firstChild).toBeNull();
    });

    it('should render form fields correctly', () => {
      setup();

      expect(screen.getByTestId('path-field')).toBeInTheDocument();
      expect(screen.getByTestId('comment-field')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-fields')).toBeInTheDocument();
    });

    it('should disable fields when read-only', () => {
      setup({
        provisionedData: {
          readOnly: true,
        },
      });

      expect(screen.getByTestId('path-field')).toHaveAttribute('readOnly');
      expect(screen.getByTestId('comment-field')).toBeDisabled();
      expect(screen.getByRole('button', { name: /delete dashboard/i })).toBeDisabled();
    });

    it('should not show workflow fields for non-GitHub repositories', () => {
      setup({
        provisionedData: {
          isGitHub: false,
        },
      });

      expect(screen.queryByTestId('workflow-fields')).not.toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      setup();

      expect(screen.getByRole('button', { name: /delete dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should handle workflow field visibility correctly', () => {
      // Test all combinations of isGitHub and readOnly
      const testCases = [
        { isGitHub: true, readOnly: false, shouldShow: true },
        { isGitHub: true, readOnly: true, shouldShow: false },
        { isGitHub: false, readOnly: false, shouldShow: false },
        { isGitHub: false, readOnly: true, shouldShow: false },
      ];

      testCases.forEach(({ isGitHub, readOnly, shouldShow }) => {
        const { unmount } = setup({
          provisionedData: {
            isGitHub,
            readOnly,
          },
        });

        if (shouldShow) {
          expect(screen.getByTestId('workflow-fields')).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId('workflow-fields')).not.toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('Form Submission', () => {
    it('should successfully delete dashboard with branch workflow', async () => {
      const { user } = setup();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith({
          name: 'test-repo',
          path: 'dashboards/test.json',
          ref: 'main',
          message: 'Delete dashboard: Test Dashboard',
        });
      });
    });

    it('should handle missing repository name', async () => {
      const { user } = setup({
        provisionedData: {
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
        },
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      expect(consoleSpy).toHaveBeenCalledWith('Missing required fields for deletion:', {
        repo: '',
        path: 'dashboards/test.json',
      });
      expect(mockDeleteRepoFile).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle missing path', async () => {
      const { user } = setup({
        provisionedData: {
          defaultValues: {
            repo: 'test-repo',
            ref: 'main',
            workflow: 'branch' as const,
            path: '',
            comment: '',
            title: 'Test Dashboard',
            description: 'Test Description',
            folder: { uid: 'test-folder', title: 'Test Folder' },
          },
        },
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      expect(consoleSpy).toHaveBeenCalledWith('Missing required fields for deletion:', {
        repo: 'test-repo',
        path: '',
      });
      expect(mockDeleteRepoFile).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle error state', async () => {
      const error = new Error('API Error');
      setup({
        requestState: {
          isError: true,
          error,
        },
      });

      await waitFor(() => {
        expect(mockPublish).toHaveBeenCalledWith({
          type: AppEvents.alertError.name,
          payload: ['Error saving delete dashboard changes', error],
        });
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state when deletion is in progress', () => {
      setup({
        requestState: {
          isLoading: true,
        },
      });

      const deleteButton = screen.getByRole('button', { name: /deleting/i });
      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveTextContent('Deleting...');
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
