import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getAppEvents } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { AnnoKeyFolder, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

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

jest.mock('../../hooks/useProvisionedRequestHandler', () => {
  return {
    useProvisionedRequestHandler: jest.fn(),
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

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => {
  return {
    useGetResourceRepositoryView: jest.fn(),
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

// Mock RTK Query hook used inside ResourceEditFormSharedFields to avoid requiring a Redux Provider
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryRefsQuery: jest.fn().mockReturnValue({ data: { items: [] }, isLoading: false, error: null }),
}));

jest.mock('app/features/dashboard-scene/saving/SaveDashboardForm', () => {
  const actual = jest.requireActual('app/features/dashboard-scene/saving/SaveDashboardForm');
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
    repository: {
      type: 'github',
      name: 'test-repo',
      title: 'Test Repo',
      workflows: ['branch', 'write'],
      target: 'folder',
    },
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
    readOnly: false,
    workflowOptions: [
      { label: 'Branch', value: 'branch' },
      { label: 'Write', value: 'write' },
    ],
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
    const mockAction = jest.fn();
    const mockRequest = { ...mockRequestBase, isSuccess: true };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    const { user, props } = setup();
    const newDashboard = {
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: {
        generateName: 'p',
        name: undefined,
      },
      spec: {
        title: 'New Dashboard',
        description: 'New Description',
        panels: [],
        schemaVersion: 36,
      },
    };
    props.dashboard.getSaveResource = jest.fn().mockReturnValue(newDashboard);

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
      expect(mockAction).toHaveBeenCalledWith({
        ref: 'dashboard/2023-01-01-abcde',
        name: 'test-repo',
        path: 'test-dashboard.json',
        message: 'Initial commit',
        body: newDashboard,
      });
    });
  });

  it('should update an existing dashboard successfully', async () => {
    const mockAction = jest.fn();
    const mockRequest = { ...mockRequestBase, isSuccess: true };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);

    const updatedDashboard = {
      apiVersion: 'dashboard.grafana.app/vXyz',
      metadata: {
        name: 'test-dashboard',
        annotations: {
          [AnnoKeyFolder]: 'folder-uid',
          [AnnoKeySourcePath]: 'path/to/file.json',
        },
      },
      spec: { title: 'Test Dashboard', description: 'Test Description' },
    };
    const { user } = setup({
      isNew: false,
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: updatedDashboard.metadata.annotations[AnnoKeyFolder],
            slug: 'test-dashboard',
            uid: updatedDashboard.metadata.name,
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        }),
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveResource: jest.fn().mockReturnValue(updatedDashboard),
        setManager: jest.fn(),
      } as unknown as DashboardScene,
    });

    const pathInput = screen.getByRole('textbox', { name: /path/i });
    expect(pathInput).toHaveAttribute('readonly'); // can not edit the path value

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(commentInput);
    await user.type(commentInput, 'Update dashboard');
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);
    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        ref: 'dashboard/2023-01-01-abcde',
        name: 'test-repo',
        path: 'test-dashboard.json',
        message: 'Update dashboard',
        body: updatedDashboard,
      });
    });
  });

  it('should show error when save fails', async () => {
    const mockAction = jest.fn();
    const mockRequest = {
      ...mockRequestBase,
      isSuccess: false,
      isError: true,
      error: 'Failed to save dashboard',
    };
    (useCreateOrUpdateRepositoryFile as jest.Mock).mockReturnValue([mockAction, mockRequest]);
    const { user, props } = setup();
    const newDashboard = {
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: {
        generateName: 'p',
        name: undefined,
      },
      spec: {
        title: 'New Dashboard',
        description: 'New Description',
        panels: [],
        schemaVersion: 36,
      },
    };
    props.dashboard.getSaveResource = jest.fn().mockReturnValue(newDashboard);

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
        ref: 'dashboard/2023-01-01-abcde',
        name: 'test-repo',
        path: 'error-dashboard.json',
        message: 'Error commit',
        body: newDashboard,
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

  it('should properly handle read-only state for a repository without workflows', () => {
    setup({
      isNew: false,
      readOnly: true,
    });

    // Alert is shown
    expect(screen.getByRole('alert', { name: 'This repository is read only' })).toBeInTheDocument();

    // Save button is disabled
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();

    // Common options are not shown for existing dashboards
    expect(screen.queryByTestId('common-options')).not.toBeInTheDocument();

    // Workflow options are not shown
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    // Branch field is not shown
    expect(screen.queryByRole('textbox', { name: /branch/i })).not.toBeInTheDocument();
  });
});
