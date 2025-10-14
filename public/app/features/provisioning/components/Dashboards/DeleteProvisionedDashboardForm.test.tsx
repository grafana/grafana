import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  useCreateRepositoryJobsMutation,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ProvisionedDashboardData, useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { DeleteProvisionedDashboardDrawer, Props } from './DeleteProvisionedDashboardDrawer';

jest.mock('../../hooks/useProvisionedDashboardData', () => ({
  useProvisionedDashboardData: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useDeleteRepositoryFilesWithPathMutation: jest.fn(),
  useCreateRepositoryJobsMutation: jest.fn(),
  provisioningAPIv0alpha1: {
    endpoints: {
      listRepository: {
        select: jest.fn(() => () => ({ data: { items: [] } })),
      },
    },
  },
}));
jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useDispatch: jest.fn(),
  };
});
jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(({ request, handlers }) => {
    if (request.isError && handlers.onError) {
      handlers.onError(request.error, { repoType: 'github', resourceType: 'dashboard', workflow: 'branch' });
    }
  }),
}));
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

// Mock shared form components
jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: ({ disabled }: { disabled: boolean }) => (
    <textarea data-testid="shared-fields" disabled={disabled} />
  ),
}));

const mockDeleteRepoFile = jest.fn();
const mockCreateJob = jest.fn();
const mockPublish = jest.fn();
const mockUseDeleteRepositoryFiles = useDeleteRepositoryFilesWithPathMutation as jest.MockedFunction<
  typeof useDeleteRepositoryFilesWithPathMutation
>;
const mockUseCreateRepositoryJobs = useCreateRepositoryJobsMutation as jest.MockedFunction<
  typeof useCreateRepositoryJobsMutation
>;
const mockUseProvisionedDashboardData = useProvisionedDashboardData as jest.MockedFunction<
  typeof useProvisionedDashboardData
>;

// Mock request state helper
type MockRequestState = {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error;
  reset: () => void;
};

const createMockRequestState = (overrides: Partial<MockRequestState> = {}): MockRequestState => ({
  isLoading: false,
  isSuccess: false,
  isError: false,
  reset: jest.fn(),
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
    createMockRequestState(requestState) as ReturnType<typeof useDeleteRepositoryFilesWithPathMutation>[1],
  ]);
  mockUseCreateRepositoryJobs.mockReturnValue([
    mockCreateJob,
    createMockRequestState(requestState) as ReturnType<typeof useCreateRepositoryJobsMutation>[1],
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

      expect(screen.getByRole('heading', { name: 'Delete Provisioned Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    it('should return null when defaultValues are not provided', () => {
      setup({
        provisionedData: {
          defaultValues: null,
        },
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

      expect(consoleSpy).toHaveBeenCalledWith('Missing required repository for deletion:', {
        repo: '',
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

      const deleteButton = screen.getByRole('button', { name: /delete dashboard/i });
      await user.click(deleteButton);

      expect(mockDeleteRepoFile).toHaveBeenCalled();
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
          payload: ['Failed to delete dashboard', error],
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
