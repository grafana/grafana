import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { type Dashboard } from '@grafana/schema';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { AnnoKeyFolder, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';

import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';
import { setupProvisioningMswServer } from '../../mocks/server';

import { type Props, SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
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

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  dashboardWatcher: {
    ignoreSaveIndefinitely: jest.fn(),
    clearIgnoreSave: jest.fn(),
    ignoreNextSave: jest.fn(),
  },
}));

jest.mock('app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker', () => {
  return {
    ProvisioningAwareFolderPicker: () => <div data-testid="folder-picker">Mocked Folder Picker</div>,
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

// Mock the new hooks that depend on router context
jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGetRepositoryFolders', () => ({
  useGetRepositoryFolders: jest.fn().mockReturnValue({ options: [], loading: false, error: null }),
}));

jest.mock('app/features/dashboard-scene/saving/SaveDashboardForm', () => {
  const actual = jest.requireActual('app/features/dashboard-scene/saving/SaveDashboardForm');
  return {
    ...actual,
    SaveDashboardFormCommonOptions: () => <div data-testid="common-options">Common Options</div>,
  };
});

function setup(props: Partial<Props> = {}) {
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
      getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
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
    canPushToConfiguredBranch: true,
    ...props,
  };

  return {
    props: defaultProps,
    ...render(<SaveProvisionedDashboardForm {...defaultProps} />),
  };
}

function requireCapturedRequest(capturedRequest: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(capturedRequest).not.toBeNull();
  return capturedRequest as { url: URL; body: unknown };
}

describe('SaveProvisionedDashboardForm', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    (validationSrv.validateNewDashboardName as jest.Mock).mockResolvedValue(true);
  });

  it('should render the form with correct fields for a new dashboard', async () => {
    setup();

    // Wait for async RTK Query operations to settle
    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByTestId('folder-picker')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /folder/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should render the form with correct fields for an existing dashboard', async () => {
    // existing dashboards show "Common Options" instead of the title/desc fields
    setup({ isNew: false });

    expect(await screen.findByTestId('common-options')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /folder/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /description/i })).not.toBeInTheDocument();
  });

  it('should save a new dashboard successfully', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-dashboard' }, spec: { title: 'New Dashboard' } } },
        });
      })
    );

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

    const { user, props } = setup();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue(newDashboard);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    const descriptionInput = screen.getByRole('textbox', { name: /description/i });
    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');

    await user.clear(filenameInput);
    await user.type(filenameInput, 'custom-filename.json');
    await user.type(commentInput, 'Initial commit');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/custom-filename.json');
    expect(request.url.searchParams.get('ref')).toBe('dashboard/2023-01-01-abcde');
    expect(request.url.searchParams.get('message')).toBe('Initial commit');
    expect(request.body).toEqual(newDashboard);
  });

  it('uses the repository commit.singleResourceMessageTemplate when the comment is empty', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-dashboard' }, spec: { title: 'Test Dashboard' } } },
        });
      })
    );

    const { user, props } = setup({
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        commit: { singleResourceMessageTemplate: 'feat({{resourceKind}}s): {{action}} {{title}}' },
      },
    });
    // dashboard.state.title is accessed directly in handleFormSubmit (not via useState)
    (props.dashboard as unknown as { state: { title: string; meta: object } }).state = {
      title: 'Test Dashboard',
      meta: {},
    };
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'Test Dashboard', panels: [], schemaVersion: 36 },
    });

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(commentInput);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });
    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.searchParams.get('message')).toBe('feat(dashboards): create Test Dashboard');
  });

  it('should update an existing dashboard successfully', async () => {
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'test-dashboard' }, spec: { title: 'Test Dashboard' } } },
        });
      })
    );

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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(commentInput);
    await user.type(commentInput, 'Update dashboard');
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/test-dashboard.json');
    expect(request.url.searchParams.get('ref')).toBe('dashboard/2023-01-01-abcde');
    expect(request.url.searchParams.get('message')).toBe('Update dashboard');
    expect(request.body).toEqual(updatedDashboard);
  });

  it('should rename file when path changes on existing dashboard', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'test-dashboard' }, spec: { title: 'Test Dashboard' } } },
        });
      })
    );

    const updatedDashboard = {
      apiVersion: 'dashboard.grafana.app/vXyz',
      metadata: {
        name: 'test-dashboard',
        annotations: {
          [AnnoKeyFolder]: 'folder-uid',
          [AnnoKeySourcePath]: 'old-path/dashboard.json',
        },
      },
      spec: { title: 'Test Dashboard', description: 'Test Description' },
    };

    const { user } = setup({
      isNew: false,
      defaultValues: {
        ref: 'main',
        path: 'old-path/dashboard.json',
        repo: 'test-repo',
        comment: '',
        folder: { uid: 'folder-uid', title: '' },
        title: 'Test Dashboard',
        description: 'Test Description',
        workflow: 'write',
      },
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    await user.clear(filenameInput);
    await user.type(filenameInput, 'renamed-dashboard.json');

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.type(commentInput, 'Rename dashboard');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    // POST goes to the NEW path
    expect(request.url.pathname).toContain('/repositories/test-repo/files/old-path/renamed-dashboard.json');
    // originalPath contains the OLD path
    expect(request.url.searchParams.get('originalPath')).toBe('old-path/dashboard.json');
    expect(request.url.searchParams.get('message')).toBe('Rename dashboard');
  });

  it('should keep using PUT when path is unchanged on existing dashboard', async () => {
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'test-dashboard' }, spec: { title: 'Test Dashboard' } } },
        });
      })
    );

    const updatedDashboard = {
      apiVersion: 'dashboard.grafana.app/vXyz',
      metadata: {
        name: 'test-dashboard',
        annotations: {
          [AnnoKeyFolder]: 'folder-uid',
          [AnnoKeySourcePath]: 'existing-dashboard.json',
        },
      },
      spec: { title: 'Test Dashboard', description: 'Test Description' },
    };

    const { user } = setup({
      isNew: false,
      defaultValues: {
        ref: 'main',
        path: 'existing-dashboard.json',
        repo: 'test-repo',
        comment: '',
        folder: { uid: 'folder-uid', title: '' },
        title: 'Test Dashboard',
        description: 'Test Description',
        workflow: 'write',
      },
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.type(commentInput, 'Update dashboard');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    // PUT goes to the same path
    expect(request.url.pathname).toContain('/repositories/test-repo/files/existing-dashboard.json');
    // No originalPath param
    expect(request.url.searchParams.get('originalPath')).toBeNull();
  });

  it('should enable save button when only the path changes on existing dashboard', async () => {
    const { user } = setup({
      isNew: false,
      defaultValues: {
        ref: 'main',
        path: 'existing-dashboard.json',
        repo: 'test-repo',
        comment: '',
        folder: { uid: 'folder-uid', title: '' },
        title: 'Test Dashboard',
        description: 'Test Description',
        workflow: 'write',
      },
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    const saveButton = screen.getByRole('button', { name: /save/i });

    expect(saveButton).toBeDisabled();

    await user.clear(filenameInput);
    await user.type(filenameInput, 'new-name.json');

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
  });

  it('should send correct request body when save returns an error', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ message: 'Failed to save dashboard' }, { status: 500 });
      })
    );

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

    const { user, props } = setup();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue(newDashboard);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    const descriptionInput = screen.getByRole('textbox', { name: /description/i });
    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    await user.clear(titleInput);
    await user.clear(descriptionInput);
    await user.clear(commentInput);

    await user.type(titleInput, 'New Dashboard');
    await user.type(descriptionInput, 'New Description');

    await user.clear(filenameInput);
    await user.type(filenameInput, 'error-dashboard.json');
    await user.type(commentInput, 'Error commit');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/error-dashboard.json');
    expect(request.url.searchParams.get('ref')).toBe('dashboard/2023-01-01-abcde');
    expect(request.url.searchParams.get('message')).toBe('Error commit');
    expect(request.body).toEqual(newDashboard);
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
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
    expect(screen.queryByRole('combobox', { name: /branch/i })).not.toBeInTheDocument();

    // Branch field is not shown
    expect(screen.queryByRole('combobox', { name: /branch/i })).not.toBeInTheDocument();
  });

  it('enables save button when only the comment changes', async () => {
    const { user } = setup({
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    const saveButton = screen.getByRole('button', { name: /save/i });

    expect(saveButton).toBeDisabled();

    await user.type(commentInput, 'Comment-only change');

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
  });

  describe('title-to-filename auto-sync', () => {
    it('should auto-update filename when the title changes for a new dashboard', async () => {
      const { user } = setup({
        defaultValues: {
          ref: 'dashboard/2023-01-01-abcde',
          path: 'new-dashboard-2023-01-01-abcde.json',
          repo: 'test-repo',
          comment: '',
          folder: { uid: 'folder-uid', title: '' },
          title: '',
          description: '',
          workflow: 'write',
        },
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.type(titleInput, 'My Cool Dashboard');

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      await waitFor(() => {
        expect(filenameInput).toHaveValue('my-cool-dashboard.json');
      });
    });

    it('should keep directory in folder picker when auto-syncing filename', async () => {
      const { user } = setup({
        defaultValues: {
          ref: 'dashboard/2023-01-01-abcde',
          path: 'dashboards/new-dashboard-2023-01-01-abcde.json',
          repo: 'test-repo',
          comment: '',
          folder: { uid: 'folder-uid', title: '' },
          title: '',
          description: '',
          workflow: 'write',
        },
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.type(titleInput, 'My Cool Dashboard');

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      const folderCombobox = screen.getByRole('combobox', { name: /folder/i });
      await waitFor(() => {
        expect(filenameInput).toHaveValue('my-cool-dashboard.json');
        expect(folderCombobox).toHaveValue('dashboards');
      });
    });

    it('should stop auto-syncing once the user manually edits the filename', async () => {
      const { user } = setup({
        defaultValues: {
          ref: 'dashboard/2023-01-01-abcde',
          path: 'new-dashboard-2023-01-01-abcde.json',
          repo: 'test-repo',
          comment: '',
          folder: { uid: 'folder-uid', title: '' },
          title: '',
          description: '',
          workflow: 'write',
        },
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      const filenameInput = screen.getByRole('textbox', { name: /filename/i });

      // First verify auto-sync is working
      await user.type(titleInput, 'First Title');
      await waitFor(() => {
        expect(filenameInput).toHaveValue('first-title.json');
      });

      // Manually edit the filename to stop auto-sync
      await user.clear(filenameInput);
      await user.type(filenameInput, 'custom-name.json');

      // Change the title again — filename should NOT update
      await user.clear(titleInput);
      await user.type(titleInput, 'Second Title');

      await waitFor(() => {
        expect(filenameInput).toHaveValue('custom-name.json');
      });
    });

    it('should not auto-sync for special-character-only titles', async () => {
      const { user } = setup({
        defaultValues: {
          ref: 'dashboard/2023-01-01-abcde',
          path: 'new-dashboard-2023-01-01-abcde.json',
          repo: 'test-repo',
          comment: '',
          folder: { uid: 'folder-uid', title: '' },
          title: '',
          description: '',
          workflow: 'write',
        },
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.type(titleInput, '!!!');

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      expect(filenameInput).toHaveValue('new-dashboard-2023-01-01-abcde.json');
    });

    it('should not auto-sync for existing dashboards', async () => {
      setup({
        isNew: false,
        defaultValues: {
          ref: 'dashboard/2023-01-01-abcde',
          path: 'existing-dashboard.json',
          repo: 'test-repo',
          comment: '',
          folder: { uid: 'folder-uid', title: '' },
          title: 'Existing Dashboard',
          description: '',
          workflow: 'write',
        },
      });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      expect(filenameInput).toHaveValue('existing-dashboard.json');
    });
  });

  it('should save dashboard with raw JSON from editor', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'test-dashboard' }, spec: { title: 'Raw JSON Dashboard' } } },
        });
      })
    );

    const rawJson = JSON.stringify({
      title: 'Raw JSON Dashboard',
      panels: [],
      schemaVersion: 36,
    });

    const dashboardFromRawJson = {
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: {
        generateName: 'p',
        name: undefined,
      },
      spec: {
        title: 'Raw JSON Dashboard',
        panels: [],
        schemaVersion: 36,
      },
    };

    const { user } = setup({
      dashboard: {
        useState: () => ({
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        }),
        setState: jest.fn(),
        closeModal: jest.fn(),
        getSaveAsModel: jest.fn().mockReturnValue({}),
        getSaveResource: jest.fn().mockReturnValue(dashboardFromRawJson),
        getSaveResourceFromSpec: jest.fn().mockReturnValue(dashboardFromRawJson),
        setManager: jest.fn(),
        getRawJsonFromEditor: jest.fn().mockReturnValue(rawJson),
      } as unknown as DashboardScene,
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeEnabled();

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(commentInput);
    await user.type(commentInput, 'Save with raw JSON');

    await user.click(saveButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/test-dashboard.json');
    expect(request.url.searchParams.get('ref')).toBe('dashboard/2023-01-01-abcde');
    expect(request.url.searchParams.get('message')).toBe('Save with raw JSON');
    expect(request.body).toEqual(dashboardFromRawJson);
  });

  it('clears dashboardWatcher suppression on error and surfaces the error message', async () => {
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
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    // Populate the commit comment so the submit handler doesn't fall back to
    // `dashboard.state.title` (which the mocked scene doesn't expose).
    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.type(commentInput, 'Retry save');

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Submit must enter the suppressed state before the error path is exercised;
    // the whole point of the regression is that a *subsequent* error still clears it.
    await waitFor(() => {
      expect(dashboardWatcher.ignoreSaveIndefinitely).toHaveBeenCalled();
    });

    const mockHook = useProvisionedRequestHandler as jest.Mock;
    const { handlers } = mockHook.mock.calls.at(-1)![0];
    await act(async () => {
      handlers.onError(new Error('boom'), { repoType: 'github' });
    });

    expect(dashboardWatcher.clearIgnoreSave).toHaveBeenCalled();
    // getProvisionedRequestError -> extractErrorMessage surfaces error.message verbatim
    // as the ProvisioningAlert title.
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
