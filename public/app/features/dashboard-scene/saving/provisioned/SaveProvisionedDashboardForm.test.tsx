import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

import { DashboardScene } from '../../scene/DashboardScene';
import { SaveDashboardDrawer } from '../SaveDashboardDrawer';

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

jest.mock('app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile', () => {
  return {
    useCreateOrUpdateRepositoryFile: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/useGetResourceRepository', () => {
  return {
    useGetResourceRepository: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/useRepositoryList', () => {
  return {
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

jest.mock('../SaveDashboardForm', () => {
  const actual = jest.requireActual('../SaveDashboardForm');
  return {
    ...actual,
    SaveDashboardFormCommonOptions: () => <div data-testid="common-options">Common Options</div>,
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
      diffCount: 0,
      hasChanges: true,
      hasTimeChanges: false,
      hasVariableValueChanges: false,
      hasRefreshChange: false,
      diffs: {},
    },
    isNew: true,
    isGitHub: true,
    defaultValues: {
      ref: 'dashboard/2023-01-01-abcde',
      path: 'test-dashboard.json',
      repo: 'test-repo',
      comment: '',
      folder: { uid: 'folder-uid', title: '' },
      title: 'Test Dashboard',
      description: 'Test Description',
      workflow: 'write',
    },
    repositoryConfig: {
      type: 'github',
      workflows: ['write', 'branch'],
      sync: { enabled: false, target: 'folder' },
      title: 'Test Repository',
      github: {
        branch: 'main',
        generateDashboardPreviews: false,
      },
    },
    ...props,
  };

  return {
    user,
    props: defaultProps,
    ...render(<SaveProvisionedDashboardForm {...defaultProps} />),
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
    (getAppEvents as jest.Mock).mockReturnValue({ publish: jest.fn() });
    (validationSrv.validateNewDashboardName as jest.Mock).mockResolvedValue(true);
    const mockRequest = { ...mockRequestBase, isSuccess: false };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([jest.fn(), mockRequest]);
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
    // existing dashboards show "Common Options" instead of the title/desc fields
    setup({ isNew: false });
    expect(screen.getByTestId('common-options')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /path/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /description/i })).not.toBeInTheDocument();
  });

  it('should save a new dashboard successfully', async () => {
    const { user, props } = setup();
    const newDashboard = {
      title: 'New Dashboard',
      description: 'New Description',
      panels: [],
      schemaVersion: 36,
    };
    props.dashboard.getSaveAsModel = jest.fn().mockReturnValue(newDashboard);
    const mockAction = jest.fn();
    const mockRequest = { ...mockRequestBase, isSuccess: true };
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
        body: newDashboard,
      });
    });
    const appEvents = getAppEvents();
    expect(appEvents.publish).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Dashboard changes saved'],
    });
    expect(props.dashboard.closeModal).toHaveBeenCalled();
    expect(locationService.partial).toHaveBeenCalledWith({ viewPanel: null, editPanel: null });
  });

  it('should update an existing dashboard successfully', async () => {
    const { user, props } = setup({
      isNew: false,
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            k8s: { name: 'test-dashboard' },
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        }),
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveAsModel: jest.fn().mockReturnValue({ title: 'Test Dashboard', description: 'Test Description' }),
        setManager: jest.fn(),
      } as unknown as DashboardScene,
    });
    const mockAction = jest.fn();
    const mockRequest = { ...mockRequestBase, isSuccess: true };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);
    const pathInput = screen.getByRole('textbox', { name: /path/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(pathInput);
    await user.clear(commentInput);
    await user.type(pathInput, 'test-dashboard.json');
    await user.type(commentInput, 'Update dashboard');
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
    expect(locationService.partial).toHaveBeenCalledWith({ viewPanel: null, editPanel: null });
  });

  it('should show error when save fails', async () => {
    const { user, props } = setup();
    const newDashboard = {
      title: 'New Dashboard',
      description: 'New Description',
      panels: [],
      schemaVersion: 36,
    };
    props.dashboard.getSaveAsModel = jest.fn().mockReturnValue(newDashboard);
    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: false,
      isError: true,
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
        body: newDashboard,
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
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            k8s: { name: 'test-dashboard' },
          },
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
