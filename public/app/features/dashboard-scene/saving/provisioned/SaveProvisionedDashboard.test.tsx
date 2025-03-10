import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks';

import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { DashboardChangeInfo } from '../shared';

import { SaveProvisionedDashboard, Props } from './SaveProvisionedDashboard';
import * as hooks from './hooks';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
    locationService: {
      partial: jest.fn(),
    },
    config: {
      ...actual.config,
      panels: {
        debug: {
          state: 'alpha',
        },
      },
    },
  };
});

jest.mock('app/core/components/Select/FolderPicker', () => {
  const actual = jest.requireActual('app/core/components/Select/FolderPicker');
  return {
    ...actual,
    FolderPicker: function MockFolderPicker() {
      return <div data-testid="folder-picker">Folder Picker</div>;
    },
  };
});

// Mock the hooks
jest.mock('./hooks', () => {
  const actual = jest.requireActual('./hooks');
  return {
    ...actual,
    useDefaultValues: jest.fn(),
  };
});

// Mock the useCreateOrUpdateRepositoryFile hook
jest.mock('app/features/provisioning/hooks', () => {
  const actual = jest.requireActual('app/features/provisioning/hooks');
  return {
    ...actual,
    useCreateOrUpdateRepositoryFile: jest.fn(),
    useGetResourceRepository: jest.fn(),
    useRepositoryList: jest.fn(),
  };
});

// Mock the validation service
jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => {
  const actual = jest.requireActual('app/features/manage-dashboards/services/ValidationSrv');
  return {
    ...actual,
    validationSrv: {
      validateNewDashboardName: jest.fn(),
    },
  };
});

// Mock the useNavigate hook
jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

// Mock the useUrlParams hook
jest.mock('app/core/navigation/hooks', () => {
  const actual = jest.requireActual('app/core/navigation/hooks');
  return {
    ...actual,
    useUrlParams: () => [new URLSearchParams()],
  };
});

// Mock SaveDashboardFormCommonOptions component
jest.mock('../SaveDashboardForm', () => {
  const actual = jest.requireActual('../SaveDashboardForm');
  return {
    ...actual,
    SaveDashboardFormCommonOptions: function MockSaveDashboardFormCommonOptions() {
      return <div data-testid="common-options">Common Options</div>;
    },
  };
});

function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();

  // Create a minimal dashboard model for testing
  const mockDashboard: Dashboard = {
    title: 'Test Dashboard',
    uid: 'test-dashboard',
    panels: [],
    schemaVersion: 36,
  };

  const defaultProps: Props = {
    dashboard: {
      useState: () => ({
        meta: { folderUid: 'folder-uid', slug: 'test-dashboard' },
        title: 'Test Dashboard',
        description: 'Test Description',
      }),
      state: { isDirty: true },
      setState: jest.fn(),
      closeModal: jest.fn(),
      getSaveAsModel: jest.fn().mockReturnValue(mockDashboard),
      setManager: jest.fn(),
    } as unknown as DashboardScene,
    drawer: {
      onClose: jest.fn(),
    } as unknown as SaveDashboardDrawer,
    changeInfo: {
      changedSaveModel: mockDashboard,
      initialSaveModel: mockDashboard,
      diffs: [],
      diffCount: 0,
      hasChanges: true,
      hasTimeChanges: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
      message: 'Test message',
    } as unknown as DashboardChangeInfo,
    ...props,
  };

  return {
    user,
    ...render(<SaveProvisionedDashboard {...defaultProps} />),
    props: defaultProps,
  };
}

const mockRequestBase = {
  isSuccess: true,
  isError: false,
  isLoading: false,
  error: null,
  data: { resource: { upsert: {} } },
};

describe('SaveProvisionedDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    // Mock useDefaultValues
    (hooks.useDefaultValues as jest.Mock).mockReturnValue({
      values: {
        ref: 'dashboard/2023-01-01-abcde',
        path: 'test-dashboard.json',
        repo: 'test-repo',
        comment: '',
        folder: {
          uid: 'folder-uid',
          title: '',
        },
        title: 'Test Dashboard',
        description: 'Test Description',
        workflow: 'write',
      },
      isNew: true,
      isGitHub: true,
      repositoryConfig: {
        type: 'github',
        workflows: ['write', 'branch'],
      },
    });

    // Mock useCreateOrUpdateRepositoryFile
    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: true,
      isError: false,
      isLoading: false,
      error: null,
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    // Mock validateNewDashboardName
    (validationSrv.validateNewDashboardName as jest.Mock).mockResolvedValue(true);
  });

  it('should render the form with correct fields for a new dashboard', () => {
    setup();

    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByTestId('folder-picker')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /path/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should render the form with correct fields for an existing dashboard', () => {
    (hooks.useDefaultValues as jest.Mock).mockReturnValue({
      values: {
        ref: 'dashboard/2023-01-01-abcde',
        path: 'test-dashboard.json',
        repo: 'test-repo',
        comment: '',
        folder: {
          uid: 'folder-uid',
          title: '',
        },
        title: 'Test Dashboard',
        description: 'Test Description',
        workflow: 'write',
      },
      isNew: false,
      isGitHub: true,
      repositoryConfig: {
        type: 'github',
        workflows: ['write', 'branch'],
      },
    });

    setup();

    // For existing dashboards, common options should be present
    expect(screen.getByTestId('common-options')).toBeInTheDocument();

    // Common fields should still be present
    expect(screen.getByRole('textbox', { name: /path/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    // Title and description fields should not be present for existing dashboards
    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /description/i })).not.toBeInTheDocument();
  });

  it('should save a new dashboard successfully', async () => {
    const { user, props } = setup();

    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: true,
      isError: false,
      isLoading: false,
      error: null,
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    const descriptionInput = screen.getByRole('textbox', { name: /description/i });
    const pathInput = screen.getByRole('textbox', { name: /path/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    // Clear and fill inputs
    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(pathInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');
    await user.type(pathInput, 'test-dashboard.json');
    await user.type(commentInput, 'Initial commit');

    // Check form values before submission
    expect(titleInput).toHaveValue('New Dashboard');
    expect(descriptionInput).toHaveValue('New Description');
    expect(pathInput).toHaveValue('test-dashboard.json');
    expect(commentInput).toHaveValue('Initial commit');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    // Wait for useEffect to be called after request.isSuccess is set to true
    await waitFor(() => {
      expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    });
    await waitFor(() => {
      // Check if the action was called
      expect(mockAction).toHaveBeenCalled();
    });

    // Check if success alert was published
    const appEvents = getAppEvents();
    expect(appEvents.publish).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Dashboard changes saved'],
    });

    // Check if modal was closed
    expect(props.dashboard.closeModal).toHaveBeenCalled();

    // Check if location was updated
    expect(locationService.partial).toHaveBeenCalledWith({
      viewPanel: null,
      editPanel: null,
    });
  });

  it('should update an existing dashboard successfully', async () => {
    const defaultValues = {
      ref: 'dashboard/2023-01-01-abcde',
      path: 'test-dashboard.json',
      repo: 'test-repo',
      comment: '',
      folder: {
        uid: 'folder-uid',
        title: '',
      },
      title: 'Test Dashboard',
      description: 'Test Description',
      workflow: 'write',
    };

    (hooks.useDefaultValues as jest.Mock).mockReturnValue({
      values: defaultValues,
      isNew: false,
      isGitHub: true,
      repositoryConfig: {
        type: 'github',
        workflows: ['write', 'branch'],
      },
    });

    const { user, props } = setup({
      dashboard: {
        useState: () => ({
          meta: { folderUid: 'folder-uid', slug: 'test-dashboard' },
          title: 'Test Dashboard',
          description: 'Test Description',
        }),
        state: { isDirty: true }, // Mark dashboard as dirty
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveAsModel: jest.fn().mockReturnValue({
          title: 'Test Dashboard',
          description: 'Test Description',
        }),
        setManager: jest.fn(),
      } as unknown as DashboardScene,
    });

    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: true,
      isError: false,
      isLoading: false,
      error: null,
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    const pathInput = screen.getByRole('textbox', { name: /path/i });

    await user.clear(commentInput);
    await user.clear(pathInput);

    await user.type(commentInput, 'Update dashboard');
    await user.type(pathInput, defaultValues.path);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    // Wait for useEffect to be called after request.isSuccess is set to true
    await waitFor(() => {
      expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    });

    // Check if the action was called with correct parameters
    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        ref: undefined, // write workflow uses loadedFromRef which is undefined in test
        name: defaultValues.repo,
        path: defaultValues.path,
        message: 'Update dashboard',
        body: expect.any(Object),
      });
    });

    // Check if success alert was published
    const appEvents = getAppEvents();
    expect(appEvents.publish).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Dashboard changes saved'],
    });

    // Check if modal was closed
    expect(props.dashboard.closeModal).toHaveBeenCalled();

    // Check if location was updated
    expect(locationService.partial).toHaveBeenCalledWith({
      viewPanel: null,
      editPanel: null,
    });
  });

  it('should show error when save fails', async () => {
    const { user } = setup();

    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: false,
      isError: true,
      isLoading: false,
      error: 'Failed to save dashboard',
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    const descriptionInput = screen.getByRole('textbox', { name: /description/i });
    const pathInput = screen.getByRole('textbox', { name: /path/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    // Clear and fill inputs
    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(pathInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');
    await user.type(pathInput, 'test-dashboard.json');
    await user.type(commentInput, 'Initial commit');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    // Check if error alert was published
    await waitFor(() => {
      const appEvents = getAppEvents();
      expect(appEvents.publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Error saving dashboard', 'Failed to save dashboard'],
      });
    });
  });

  it('should disable save button when dashboard is not dirty', () => {
    setup({
      dashboard: {
        useState: () => ({
          meta: { folderUid: 'folder-uid', slug: 'test-dashboard' },
          title: 'Test Dashboard',
          description: 'Test Description',
        }),
        state: { isDirty: false }, // Not dirty
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveAsModel: jest.fn().mockReturnValue({}),
        setManager: jest.fn(),
      } as unknown as DashboardScene,
    });

    // Save button should be disabled
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
