import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { type Dashboard } from '@grafana/schema';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyFolder, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';

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

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

  const dashboardState = {
    meta: { folderUid: 'folder-uid', slug: 'test-dashboard' },
    title: 'Test Dashboard',
    description: 'Test Description',
    isDirty: true,
  };
  const defaultProps: Props = {
    dashboard: {
      state: dashboardState,
      useState: () => dashboardState,
      setState: jest.fn(),
      closeModal: jest.fn(),
      getSaveModel: jest.fn().mockReturnValue({}),
      saveCompleted: jest.fn(),
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

function setupFolderless(
  overrides: {
    repository?: Partial<NonNullable<Props['repository']>>;
    defaultValues?: Partial<Props['defaultValues']>;
  } = {}
) {
  return setup({
    repository: {
      type: 'github',
      name: 'test-repo',
      title: 'Test Repo',
      workflows: ['write'],
      target: 'folderless',
      ...overrides.repository,
    },
    defaultValues: {
      ref: 'main',
      path: 'test-dashboard.json',
      repo: 'test-repo',
      comment: '',
      folder: { uid: '', title: '' },
      title: 'Test Dashboard',
      description: '',
      workflow: 'write',
      ...overrides.defaultValues,
    },
  });
}

function requireCapturedRequest(capturedRequest: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(capturedRequest).not.toBeNull();
  return capturedRequest as { url: URL; body: unknown };
}

// Minimal ResourceWrapper body the real useProvisionedRequestHandler can consume
function saveSuccessResponse(name: string, title: string) {
  return HttpResponse.json({
    resource: {
      upsert: {
        apiVersion: 'v1',
        kind: 'Dashboard',
        metadata: { name, uid: name },
        spec: { title },
      },
    },
  });
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
        return saveSuccessResponse('new-dashboard', 'New Dashboard');
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

    // Success path completes the save and navigates to the newly created dashboard
    await waitFor(() => {
      expect(props.dashboard.saveCompleted).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/d/new-dashboard'));
    expect(dashboardWatcher.clearIgnoreSave).toHaveBeenCalled();
  });

  it('uses the repository commit.singleResourceMessageTemplate when the comment is empty', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
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
        return saveSuccessResponse('test-dashboard', 'Test Dashboard');
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
        state: {
          meta: {
            folderUid: updatedDashboard.metadata.annotations[AnnoKeyFolder],
            slug: 'test-dashboard',
            uid: updatedDashboard.metadata.name,
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
        getSaveResource: jest.fn().mockReturnValue(updatedDashboard),
        getSaveResourceFromSpec: jest.fn().mockReturnValue(updatedDashboard),
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

  // Regression: when updating a git-synced dashboard the committed body must come
  // from the change-trimmed model (changeInfo.changedSaveModel), not the full scene
  // save model. Otherwise unsaved variable/time/refresh values leak into the PR even
  // when the user leaves "Change default variables" unchecked (see issue #127533).
  it('commits the change-trimmed model, not the full save model, when updating', async () => {
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return saveSuccessResponse('test-dashboard', 'Test Dashboard');
      })
    );

    // The trimmed model the drawer would produce with "Change default variables" off.
    const trimmedResource = {
      apiVersion: 'dashboard.grafana.app/vXyz',
      kind: 'Dashboard',
      metadata: { name: 'test-dashboard' },
      spec: { title: 'Test Dashboard', templating: { list: [{ name: 'v', current: { value: 'original' } }] } },
    };
    const trimmedSaveModel = trimmedResource.spec;

    // getSaveResource would serialize the full scene (current variable value) — the bug.
    const fullResource = {
      ...trimmedResource,
      spec: { title: 'Test Dashboard', templating: { list: [{ name: 'v', current: { value: 'changed' } }] } },
    };

    const getSaveResourceFromSpec = jest.fn().mockReturnValue(trimmedResource);
    const getSaveResource = jest.fn().mockReturnValue(fullResource);
    const saveCompleted = jest.fn();
    // Full, untrimmed scene model — must NOT be used to baseline after save.
    const fullSaveModel = {
      title: 'Test Dashboard',
      templating: { list: [{ name: 'v', current: { value: 'changed' } }] },
    };
    const getSaveModel = jest.fn().mockReturnValue(fullSaveModel);

    const { user } = setup({
      isNew: false,
      changeInfo: {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        changedSaveModel: trimmedSaveModel as unknown as Dashboard,
        // Distinct baseline (old title) so the fixture reads coherently: an existing
        // dashboard with a real, saved change.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        initialSaveModel: {
          title: 'Original Dashboard',
          templating: { list: [{ name: 'v', current: { value: 'original' } }] },
        } as unknown as Dashboard,
        diffCount: 1,
        hasChanges: true,
        hasTimeChanges: false,
        hasVariableValueChanges: false,
        hasRefreshChange: false,
        diffs: {},
      },
      dashboard: {
        state: { meta: { folderUid: 'folder-uid', slug: 'test-dashboard', uid: 'test-dashboard' }, isDirty: true },
        useState: () => ({
          meta: { folderUid: 'folder-uid', slug: 'test-dashboard', uid: 'test-dashboard' },
          isDirty: true,
        }),
        setState: jest.fn(),
        saveCompleted,
        getSaveModel,
        getSaveResource,
        getSaveResourceFromSpec,
        setManager: jest.fn(),
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      } as unknown as DashboardScene,
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    // Body must be built from the trimmed changedSaveModel, and getSaveResource
    // (the full scene serializer) must not be used on the update path.
    expect(getSaveResourceFromSpec).toHaveBeenCalledWith(trimmedSaveModel);
    expect(getSaveResource).not.toHaveBeenCalled();
    const request = requireCapturedRequest(capturedRequest);
    expect(request.body).toEqual(trimmedResource);

    // saveCompleted must re-baseline against the same trimmed model, not the full
    // scene model — otherwise change detection treats the omitted values as saved.
    await waitFor(() => {
      expect(saveCompleted).toHaveBeenCalledWith(trimmedSaveModel, expect.anything(), expect.anything());
    });
    expect(saveCompleted).not.toHaveBeenCalledWith(fullSaveModel, expect.anything(), expect.anything());
  });

  it('shows the in-progress state on Save while new dashboard validation is pending', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-dashboard' }, spec: { title: 'New Dashboard' } } },
        });
      })
    );

    // Hold title validation open so the submit stays in its validation phase.
    let resolveValidation!: (value: unknown) => void;
    const validationPromise = new Promise((resolve) => {
      resolveValidation = resolve;
    });
    (validationSrv.validateNewDashboardName as jest.Mock).mockReturnValue(validationPromise);

    const newDashboard = {
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p', name: undefined },
      spec: { title: 'New Dashboard', panels: [], schemaVersion: 36 },
    };

    const { user, props } = setup();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue(newDashboard);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'New Dashboard');

    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    await user.clear(filenameInput);
    await user.type(filenameInput, 'custom-filename.json');

    await user.click(screen.getByRole('button', { name: /save/i }));

    // The button reflects the in-progress submit during validation, before the create POST fires.
    const savingButton = await screen.findByRole('button', { name: /saving/i });
    expect(savingButton).toBeDisabled();
    expect(capturedRequest).toBeNull();

    // Completing validation lets the create POST go out.
    await act(async () => {
      resolveValidation(true);
    });
    await waitFor(() => expect(capturedRequest).not.toBeNull());
  });

  it('re-enables Save and skips the write when new dashboard validation fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-dashboard' }, spec: { title: 'New Dashboard' } } },
        });
      })
    );

    (validationSrv.validateNewDashboardName as jest.Mock).mockRejectedValue(
      new Error('A dashboard or a folder with the same name already exists')
    );

    const { user, props } = setup();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'New Dashboard', panels: [], schemaVersion: 36 },
    });

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'New Dashboard');

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Failed validation re-enables the button and never fires the create POST.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });
    expect(capturedRequest).toBeNull();
  });

  it('shows the in-progress state on Save while an existing dashboard is being written', async () => {
    // Hold the write open so the in-progress state stays observable without a timing race.
    let resolveWrite: () => void;
    const writeInFlight = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        await writeInFlight;
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
        state: {
          meta: {
            folderUid: updatedDashboard.metadata.annotations[AnnoKeyFolder],
            slug: 'test-dashboard',
            uid: updatedDashboard.metadata.name,
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        },
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
        getSaveResourceFromSpec: jest.fn().mockReturnValue(updatedDashboard),
        setManager: jest.fn(),
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.clear(commentInput);
    await user.type(commentInput, 'Update dashboard');
    await user.click(screen.getByRole('button', { name: /save/i }));

    // The in-progress state shows for edits too, while the write is in flight.
    const savingButton = await screen.findByRole('button', { name: /saving/i });
    expect(savingButton).toBeDisabled();
    expect(capturedRequest).toBeNull();

    // Release the write and let it complete.
    await act(async () => {
      resolveWrite();
    });
    await waitFor(() => expect(capturedRequest).not.toBeNull());
  });

  it('should rename file when path changes on existing dashboard', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return saveSuccessResponse('test-dashboard', 'Test Dashboard');
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
        getSaveResource: jest.fn().mockReturnValue(updatedDashboard),
        getSaveResourceFromSpec: jest.fn().mockReturnValue(updatedDashboard),
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
        return saveSuccessResponse('test-dashboard', 'Test Dashboard');
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
        getSaveResource: jest.fn().mockReturnValue(updatedDashboard),
        getSaveResourceFromSpec: jest.fn().mockReturnValue(updatedDashboard),
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            uid: 'test-dashboard',
            k8s: { name: 'test-dashboard' },
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            k8s: { name: 'test-dashboard' },
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
            k8s: { name: 'test-dashboard' },
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
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
        return saveSuccessResponse('test-dashboard', 'Raw JSON Dashboard');
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
        state: {
          meta: {
            folderUid: 'folder-uid',
            slug: 'test-dashboard',
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: false,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
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

  it('shows New folder button for folderless repos in write mode', async () => {
    setupFolderless();

    expect(await screen.findByRole('button', { name: /new folder/i })).toBeInTheDocument();
  });

  it('does not show New folder button for non-folderless repos', async () => {
    setup({
      repository: { type: 'github', name: 'test-repo', title: 'Test Repo', workflows: ['write'], target: 'folder' },
    });

    await screen.findByRole('form');
    expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument();
  });

  it('does not show New folder button when workflow is branch', async () => {
    setupFolderless({ repository: { workflows: ['branch'] }, defaultValues: { workflow: 'branch' } });

    await screen.findByRole('form');
    expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument();
  });

  it('does not show New folder button for read-only repos (no workflow)', async () => {
    setupFolderless({ repository: { workflows: [] }, defaultValues: { workflow: undefined } });

    await screen.findByRole('form');
    expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument();
  });

  it('creates a folder when New folder is used in folderless mode', async () => {
    let folderRequest: { url: URL; body: unknown } | null = null;
    let dashboardRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.json();
        if ((body as Record<string, unknown>).type === 'folder') {
          folderRequest = { url, body };
          return HttpResponse.json({
            resource: {
              upsert: {
                metadata: { name: 'new-folder-uid' },
                spec: { title: 'My Team' },
              },
            },
          });
        }
        dashboardRequest = { url, body };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
      })
    );

    const { user, props } = setupFolderless();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'Test Dashboard', panels: [], schemaVersion: 36 },
    });

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'My Team');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(folderRequest).not.toBeNull());
    // raw title is used for the path (no slugification)
    expect(decodeURIComponent(folderRequest!.url.pathname)).toContain('/repositories/test-repo/files/My Team/');

    // saving the dashboard after folder creation should place it inside the new folder
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(dashboardRequest).not.toBeNull());
    expect(decodeURIComponent(dashboardRequest!.url.pathname)).toContain(
      '/repositories/test-repo/files/My Team/test-dashboard.json'
    );
  });

  it('creates the folder once on Enter without submitting the dashboard form', async () => {
    let folderPostCount = 0;
    let releaseFolderPost: () => void = () => {};
    let dashboardRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const body = await request.json();
        if ((body as Record<string, unknown>).type === 'folder') {
          folderPostCount++;
          // hold the request in flight so a second Enter hits the guard deterministically
          await new Promise<void>((resolve) => {
            releaseFolderPost = resolve;
          });
          return HttpResponse.json({
            resource: { upsert: { metadata: { name: 'new-folder-uid' }, spec: { title: 'My Team' } } },
          });
        }
        dashboardRequest = { url: new URL(request.url), body };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
      })
    );

    const { user } = setupFolderless();

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'My Team{Enter}{Enter}');

    // while the folder POST is in flight, a dashboard save must not race the path update
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    releaseFolderPost();

    await waitFor(() => expect(screen.queryByRole('textbox', { name: /folder name/i })).not.toBeInTheDocument());
    expect(folderPostCount).toBe(1);
    expect(dashboardRequest).toBeNull();
  });

  it('shows a required error for whitespace-only folder names without sending a request', async () => {
    let folderRequest = false;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, () => {
        folderRequest = true;
        return HttpResponse.json({});
      })
    );

    const { user } = setupFolderless();

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), '   ');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText(/folder name is required/i)).toBeInTheDocument();
    expect(folderRequest).toBe(false);
  });

  it('nests the new folder under the selected target folder', async () => {
    let folderRequest: { url: URL; body: unknown } | null = null;
    let dashboardRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.json();
        if ((body as Record<string, unknown>).type === 'folder') {
          folderRequest = { url, body };
          return HttpResponse.json({
            resource: {
              upsert: {
                metadata: { name: 'new-folder-uid' },
                spec: { title: 'My Team' },
              },
            },
          });
        }
        dashboardRequest = { url, body };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
      })
    );

    const { user, props } = setupFolderless({
      defaultValues: { path: 'dashboards/test-dashboard.json', folder: { uid: 'dashboards-uid', title: 'dashboards' } },
    });
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'Test Dashboard', panels: [], schemaVersion: 36 },
    });

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'My Team');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(folderRequest).not.toBeNull());
    expect(decodeURIComponent(folderRequest!.url.pathname)).toContain(
      '/repositories/test-repo/files/dashboards/My Team/'
    );

    // the dashboard path should follow the folder into its nested location
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(dashboardRequest).not.toBeNull());
    expect(decodeURIComponent(dashboardRequest!.url.pathname)).toContain(
      '/repositories/test-repo/files/dashboards/My Team/test-dashboard.json'
    );
  });

  it('syncs dashboard meta with the created folder so defaults recompute against it', async () => {
    const FOLDER_BASE = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace';
    server.use(
      http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json({ metadata: { annotations: {} } }))
    );

    let dashboardRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.json();
        if ((body as Record<string, unknown>).type === 'folder') {
          return HttpResponse.json({
            resource: { upsert: { metadata: { name: 'new-folder-uid' }, spec: { title: 'My Team' } } },
          });
        }
        dashboardRequest = { url, body };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
      })
    );

    const { user, props, rerender } = setupFolderless({
      defaultValues: { path: 'dashboards/test-dashboard.json', folder: { uid: 'dashboards-uid', title: 'dashboards' } },
    });
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'Test Dashboard', panels: [], schemaVersion: 36 },
    });

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'My Team');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /folder name/i })).not.toBeInTheDocument());

    // the dashboard meta drives the upstream defaultValues recompute, mirroring the
    // folder picker's onChange, so downstream consumers see the created folder
    await waitFor(() =>
      expect(props.dashboard.setState).toHaveBeenCalledWith({
        meta: expect.objectContaining({ folderUid: 'new-folder-uid' }),
      })
    );

    // defaults recompute with a generic timestamped filename; the form must resync it from the title
    rerender(
      <SaveProvisionedDashboardForm
        {...props}
        defaultValues={{
          ...props.defaultValues,
          folder: { uid: 'new-folder-uid', title: '' },
          path: 'My Team/new-dashboard-2023-01-01-abcde.json',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(dashboardRequest).not.toBeNull());
    expect(decodeURIComponent(dashboardRequest!.url.pathname)).toContain(
      '/repositories/test-repo/files/My Team/test-dashboard.json'
    );
  });

  it('keeps the form usable when sync is disabled and no folder resource is returned', async () => {
    let dashboardRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.json();
        if ((body as Record<string, unknown>).type === 'folder') {
          // sync disabled: the folder is committed to git but no Grafana resource is created
          return HttpResponse.json({ resource: { upsert: null } });
        }
        dashboardRequest = { url, body };
        return saveSuccessResponse('new-dashboard', 'Test Dashboard');
      })
    );

    const { user, props } = setupFolderless();
    props.dashboard.getSaveResource = jest.fn().mockReturnValue({
      apiVersion: 'dashboard.grafana.app/v1alpha1',
      kind: 'Dashboard',
      metadata: { generateName: 'p' },
      spec: { title: 'Test Dashboard', panels: [], schemaVersion: 36 },
    });

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'My Team');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // the mini-form closes without error and the dashboard meta stays untouched
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /folder name/i })).not.toBeInTheDocument());
    expect(props.dashboard.setState).not.toHaveBeenCalled();

    // the dashboard still saves into the folder created in git
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(dashboardRequest).not.toBeNull());
    expect(decodeURIComponent(dashboardRequest!.url.pathname)).toContain(
      '/repositories/test-repo/files/My Team/test-dashboard.json'
    );
  });

  it('rejects invalid folder names without sending a request', async () => {
    let folderRequest = false;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, () => {
        folderRequest = true;
        return HttpResponse.json({});
      })
    );

    const { user } = setupFolderless();

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'team/a');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText(/invalid characters/i)).toBeInTheDocument();
    expect(folderRequest).toBe(false);
  });

  it('sends message and omits ref when creating a folder in write workflow', async () => {
    let folderRequest: { url: URL; body: unknown } | null = null;
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.json();
        folderRequest = { url, body };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-folder-uid' }, spec: { title: 'Team A' } } },
        });
      })
    );

    const { user } = setupFolderless({ defaultValues: { comment: 'my commit' } });

    await user.click(await screen.findByRole('button', { name: /new folder/i }));
    await user.type(screen.getByRole('textbox', { name: /folder name/i }), 'Team A');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(folderRequest).not.toBeNull());
    // a dedicated folder commit message is sent; ref is omitted for write workflow
    expect(folderRequest!.url.searchParams.get('message')).toContain('Create folder: Team A');
    expect(folderRequest!.url.searchParams.get('ref')).toBeNull();
  });

  it('clears dashboardWatcher suppression on error and surfaces the error message', async () => {
    server.use(
      http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
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
        state: {
          meta: {
            folderUid: updatedDashboard.metadata.annotations[AnnoKeyFolder],
            slug: 'test-dashboard',
            uid: updatedDashboard.metadata.name,
            k8s: updatedDashboard.metadata,
          },
          title: 'Test Dashboard',
          description: 'Test Description',
          isDirty: true,
        },
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
        getSaveModel: jest.fn().mockReturnValue({}),
        saveCompleted: jest.fn(),
        getSaveResource: jest.fn().mockReturnValue(updatedDashboard),
        getSaveResourceFromSpec: jest.fn().mockReturnValue(updatedDashboard),
        setManager: jest.fn(),
        getRawJsonFromEditor: jest.fn().mockReturnValue(undefined),
      } as unknown as DashboardScene,
    });

    // Populate the commit comment so the committed message is deterministic ('Retry save') rather
    // than the template/default rendered from the form title.
    const commentInput = screen.getByRole('textbox', { name: /comment/i });
    await user.type(commentInput, 'Retry save');

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Submit must enter the suppressed state before the error path is exercised;
    // the whole point of the regression is that a *subsequent* error still clears it.
    await waitFor(() => {
      expect(dashboardWatcher.ignoreSaveIndefinitely).toHaveBeenCalled();
    });

    // getProvisionedRequestError -> extractErrorMessage surfaces the API error message
    // verbatim as the ProvisioningAlert title.
    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(dashboardWatcher.clearIgnoreSave).toHaveBeenCalled();
  });
});

describe('SaveProvisionedDashboardForm commit message template', () => {
  beforeEach(() => {
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('pre-fills Comment from the repository template', async () => {
    setup({
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        commit: { singleResourceMessageTemplate: 'feat({{resourceKind}}s): {{action}} {{title}}' },
      },
    });

    const comment = await screen.findByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(comment).toHaveValue('feat(dashboards): create Test Dashboard'));
    expect(comment).not.toHaveAttribute('readonly');
  });
});

describe('SaveProvisionedDashboardForm branch name template', () => {
  beforeEach(() => {
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  const branchDefaultValues = {
    ref: 'dashboard/2023-01-01-abcde',
    path: 'test-dashboard.json',
    repo: 'test-repo',
    comment: '',
    folder: { uid: 'folder-uid', title: '' },
    title: 'Test Dashboard',
    description: 'Test Description',
    workflow: 'branch' as const,
  };

  it('pre-fills the branch name from the repository template on the branch workflow', async () => {
    setup({
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        branchOptions: { nameTemplate: 'grafana/{{action}}-{{title}}' },
      },
      defaultValues: branchDefaultValues,
    });

    const branch = await screen.findByRole('combobox', { name: /branch/i });
    await waitFor(() => expect(branch).toHaveValue('grafana/create-test-dashboard'));
    expect(branch).not.toHaveAttribute('readonly');
  });

  it('renders the branch field read-only when the template is enforced', async () => {
    setup({
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        branchOptions: { nameTemplate: 'grafana/{{action}}-{{title}}', enforceTemplate: true },
      },
      defaultValues: branchDefaultValues,
    });

    const branch = await screen.findByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(branch).toHaveValue('grafana/create-test-dashboard'));
    expect(branch).toHaveAttribute('readonly');
  });
});
