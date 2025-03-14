import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';
import { DashboardChangeInfo } from '../shared';

import { SaveProvisionedDashboardForm, Props } from './SaveProvisionedDashboardForm';

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

jest.mock('app/features/provisioning/hooks', () => {
  const actual = jest.requireActual('app/features/provisioning/hooks');
  return {
    ...actual,
    useCreateOrUpdateRepositoryFile: jest.fn(),
    useGetResourceRepository: jest.fn(),
    useRepositoryList: jest.fn(),
  };
});

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => {
  const actual = jest.requireActual('app/features/manage-dashboards/services/ValidationSrv');
  return {
    ...actual,
    validationSrv: {
      validateNewDashboardName: jest.fn(),
    },
  };
});

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
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

// Mock getWorkflowOptions
jest.mock('./defaults', () => {
  const actual = jest.requireActual('./defaults');
  return {
    ...actual,
    getWorkflowOptions: jest.fn().mockReturnValue([
      { label: 'Write directly', value: 'write', description: 'Write directly to the repository' },
      { label: 'Create branch', value: 'branch', description: 'Create a new branch' },
    ]),
  };
});

function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();

  const mockDashboard: Dashboard = {
    title: 'Test Dashboard',
    panels: [],
    schemaVersion: 36,
  };

  const defaultProps: Props = {
    dashboard: {
      useState: () => ({
        meta: { folderUid: 'folder-uid', slug: 'test-dashboard' },
        title: 'Test Dashboard',
        description: 'Test Description',
        isDirty: true,
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
    isNew: true,
    isGitHub: true,
    defaultValues: {
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
    repositoryConfig: {
      type: 'github',
      workflows: ['write', 'branch'],
      sync: { enabled: false, target: 'folder' },
      title: 'Test Repository',
    },
    ...props,
  };

  return {
    user,
    ...render(<SaveProvisionedDashboardForm {...defaultProps} />),
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

describe('SaveProvisionedDashboardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: false,
      isError: false,
      isLoading: false,
      error: null,
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

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
    setup({
      isNew: false,
    });

    expect(screen.getByTestId('common-options')).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /path/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /description/i })).not.toBeInTheDocument();
  });

  it('should save a new dashboard successfully', async () => {
    const { user, props } = setup();

    const mockDashboard = {
      title: 'New Dashboard',
      description: 'New Description',
      panels: [],
      schemaVersion: 36,
    };
    props.dashboard.getSaveAsModel = jest.fn().mockReturnValue(mockDashboard);

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

    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(pathInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');
    await user.type(pathInput, 'test-dashboard.json');
    await user.type(commentInput, 'Initial commit');

    expect(titleInput).toHaveValue('New Dashboard');
    expect(descriptionInput).toHaveValue('New Description');
    expect(pathInput).toHaveValue('test-dashboard.json');
    expect(commentInput).toHaveValue('Initial commit');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    });

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        ref: undefined,
        name: 'test-repo',
        path: 'test-dashboard.json',
        message: 'Initial commit',
        body: mockDashboard,
      });
    });

    const appEvents = getAppEvents();
    expect(appEvents.publish).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Dashboard changes saved'],
    });

    expect(props.dashboard.closeModal).toHaveBeenCalled();
    expect(locationService.partial).toHaveBeenCalledWith({
      viewPanel: null,
      editPanel: null,
    });
  });

  it('should update an existing dashboard successfully', async () => {
    const { user, props } = setup({
      isNew: false,
      dashboard: {
        useState: () => ({
          meta: { folderUid: 'folder-uid', slug: 'test-dashboard', k8s: { name: 'test-dashboard' } },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        }),
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
    await user.type(pathInput, 'test-dashboard.json');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    });

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        ref: undefined,
        name: 'test-repo',
        path: 'test-dashboard.json',
        message: 'Update dashboard',
        body: expect.any(Object),
      });
    });

    expect(props.dashboard.closeModal).toHaveBeenCalled();
    expect(locationService.partial).toHaveBeenCalledWith({
      viewPanel: null,
      editPanel: null,
    });
  });

  it('should show error when save fails', async () => {
    const { user, props } = setup();

    const mockDashboard = {
      title: 'New Dashboard',
      description: 'New Description',
      panels: [],
      schemaVersion: 36,
    };
    props.dashboard.getSaveAsModel = jest.fn().mockReturnValue(mockDashboard);

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

    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(pathInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');
    await user.type(pathInput, 'error-dashboard.json');
    await user.type(commentInput, 'Error commit');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        ref: undefined,
        name: 'test-repo',
        path: 'error-dashboard.json',
        message: 'Error commit',
        body: mockDashboard,
      });
    });

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
          meta: { folderUid: 'folder-uid', slug: 'test-dashboard', k8s: { name: 'test-dashboard' } },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        }),
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveAsModel: jest.fn().mockReturnValue({}),
        setManager: jest.fn(),
      } as unknown as DashboardScene,
    });

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('should show read-only alert when repository has no workflows', () => {
    setup({
      repositoryConfig: {
        type: 'github',
        workflows: [],
        sync: { enabled: false, target: 'folder' },
        title: 'Read-only Repository',
      },
    });

    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
  });
});
