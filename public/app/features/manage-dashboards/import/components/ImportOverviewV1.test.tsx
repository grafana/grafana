import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { type DashboardInputs, DashboardSource, LibraryPanelInputState } from '../../types';
import { useImportProvisionedSave } from '../hooks/useImportProvisionedSave';

import { ImportOverviewV1 } from './ImportOverviewV1';

// --- Mocks ---

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

jest.mock('../utils/validation', () => ({
  validateTitle: jest.fn().mockResolvedValue(true),
  validateUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker', () => ({
  ProvisioningAwareFolderPicker: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val?: string, title?: string) => void;
  }) => (
    <input data-testid="folder-picker" value={value ?? ''} onChange={(e) => onChange(e.target.value, 'Test Folder')} />
  ),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({
    onChange,
    pluginId,
    current,
  }: {
    onChange: (ds: { uid: string; type: string; name: string }) => void;
    pluginId: string;
    current?: string;
  }) => (
    <input
      data-testid={`datasource-picker-${pluginId}`}
      value={current || ''}
      onChange={(e) => onChange({ uid: e.target.value, type: pluginId, name: `${pluginId} instance` })}
    />
  ),
}));

jest.mock('../hooks/useImportProvisionedSave', () => ({
  useImportProvisionedSave: jest.fn(),
}));

setupProvisioningMswServer();

const mockGetDashboardAPI = jest.mocked(getDashboardAPI);
const mockUseImportProvisionedSave = jest.mocked(useImportProvisionedSave);

// --- Helpers ---

const FOLDER_BASE = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace';

const mockRepository: RepositoryView = {
  name: 'test-repo',
  branch: 'main',
  type: 'github',
  target: 'folder',
  title: 'Test Repo',
  workflows: ['write', 'branch'],
};

const mockDashboard: Dashboard = {
  title: 'Test Dashboard',
  uid: 'test-uid',
  schemaVersion: 30,
};

const defaultInputs: DashboardInputs = {
  dataSources: [],
  constants: [],
  libraryPanels: [],
};

const inputsWithLP: DashboardInputs = {
  dataSources: [],
  constants: [],
  libraryPanels: [
    {
      model: { name: 'Test LP', uid: 'lp-uid', model: { type: 'text' }, type: 'text', version: 1 },
      state: LibraryPanelInputState.New,
    },
  ],
};

function makeFolderResponse(uid: string, repoName?: string) {
  return {
    kind: 'Folder',
    apiVersion: 'folder.grafana.app/v1beta1',
    metadata: {
      name: uid,
      namespace: 'default',
      uid,
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: {
        'grafana.app/createdBy': 'user:1',
        'grafana.app/updatedBy': 'user:2',
        ...(repoName
          ? {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
              [AnnoKeyManagerIdentity]: repoName,
            }
          : {}),
      },
    },
    spec: { title: 'Test Folder', description: '' },
  };
}

function makeSettingsResponse(repos: RepositoryView[]) {
  return { items: repos, allowImageRendering: true, availableRepositoryTypes: ['github'] };
}

function setupRepoState({
  isProvisioned = false,
  isReadOnlyRepo = false,
  isOrphaned = false,
  isLoading = false,
  isError = false,
}: {
  isProvisioned?: boolean;
  isReadOnlyRepo?: boolean;
  isOrphaned?: boolean;
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  const mockSave = jest.fn();
  mockUseImportProvisionedSave.mockReturnValue({
    save: mockSave,
    isLoading: false,
    error: undefined,
  });

  if (isLoading) {
    server.use(
      http.get(`${BASE}/settings`, async () => {
        await delay('infinite');
        return HttpResponse.json(makeSettingsResponse([]));
      })
    );
    return { mockSave };
  }

  if (isError) {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'settings fetch failed' }, { status: 500 }))
    );
    return { mockSave };
  }

  if (isProvisioned || isReadOnlyRepo) {
    const repo: RepositoryView = {
      ...mockRepository,
      workflows: isReadOnlyRepo ? [] : ['write', 'branch'],
    };
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([repo]))),
      http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
        HttpResponse.json(makeFolderResponse(params.folderUid as string, 'test-repo'))
      )
    );
    return { mockSave };
  }

  if (isOrphaned) {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([mockRepository]))),
      http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
        HttpResponse.json(makeFolderResponse(params.folderUid as string, 'dead-repo'))
      )
    );
    return { mockSave };
  }

  // Non-provisioned: no repos, folder without annotations
  server.use(
    http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
      HttpResponse.json(makeFolderResponse(params.folderUid as string))
    )
  );
  return { mockSave };
}

function renderOverview(inputs: DashboardInputs = defaultInputs) {
  return render(
    <ImportOverviewV1
      dashboard={mockDashboard}
      inputs={inputs}
      meta={{ updatedAt: '', orgName: '' }}
      source={DashboardSource.Json}
      folderUid="test-folder"
      onCancel={jest.fn()}
    />
  );
}

// --- Tests ---

describe('ImportOverviewV1', () => {
  let saveDashboard = jest.fn().mockResolvedValue({ url: '/d/test-uid/test-dashboard' });

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.provisioning = true;
    saveDashboard = jest.fn().mockResolvedValue({ url: '/d/test-uid/test-dashboard' });
    mockGetDashboardAPI.mockResolvedValue({
      saveDashboard,
      getDashboardDTO: jest.fn(),
      deleteDashboard: jest.fn(),
      listDeletedDashboards: jest.fn(),
      restoreDashboard: jest.fn(),
      listDashboardHistory: jest.fn(),
      getDashboardHistoryVersions: jest.fn(),
      restoreDashboardVersion: jest.fn(),
    });
  });

  afterEach(() => {
    config.featureToggles.provisioning = false;
  });

  describe('standard (non-provisioned) path', () => {
    it('renders the import form', async () => {
      setupRepoState({ isProvisioned: false });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      });
    });

    it('does not render provisioning shared fields', async () => {
      setupRepoState({ isProvisioned: false });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      });
      expect(screen.queryByRole('textbox', { name: /filename/i })).not.toBeInTheDocument();
    });

    it('submits via standard API', async () => {
      setupRepoState({ isProvisioned: false });
      renderOverview();
      const user = userEvent.setup();

      await user.click(screen.getByTestId(selectors.components.ImportDashboardForm.submit));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });
    });
  });

  describe('provisioned mode', () => {
    it('renders ResourceEditFormSharedFields when folder is repo-managed', async () => {
      setupRepoState({ isProvisioned: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });
    });

    it('submits via provisioned save hook', async () => {
      const { mockSave } = setupRepoState({ isProvisioned: true });
      renderOverview();
      const user = userEvent.setup();

      // Wait for provisioning state to resolve
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });

      await user.click(screen.getByTestId(selectors.components.ImportDashboardForm.submit));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith(
          expect.objectContaining({
            apiVersion: 'v1',
            folderUid: 'test-folder',
            title: 'Test Dashboard',
          })
        );
      });
    });

    it('does not call standard API in provisioned mode', async () => {
      setupRepoState({ isProvisioned: true });
      renderOverview();
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });

      await user.click(screen.getByTestId(selectors.components.ImportDashboardForm.submit));

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });
  });

  describe('library panel block', () => {
    it('disables submit when LP inputs exist and folder is provisioned', async () => {
      setupRepoState({ isProvisioned: true });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
        expect(submitBtn).toBeDisabled();
      });
    });

    it('shows LP blocked alert when folder is provisioned', async () => {
      setupRepoState({ isProvisioned: true });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        expect(screen.getByText(/library panels not supported/i)).toBeInTheDocument();
      });
    });

    it('does not show LP alert in non-provisioned mode', async () => {
      setupRepoState({ isProvisioned: false });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      });
      expect(screen.queryByText(/library panels not supported/i)).not.toBeInTheDocument();
    });
  });

  describe('read-only repo', () => {
    it('renders read-only banner when repo is read-only', async () => {
      setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByText(/This repository is read only/i)).toBeInTheDocument();
      });
    });

    it('disables submit when repo is read-only', async () => {
      setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });

  describe('orphaned folder', () => {
    it('disables submit when folder is orphaned', async () => {
      setupRepoState({ isOrphaned: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });

  describe('loading state', () => {
    it('disables submit while repository is loading', async () => {
      setupRepoState({ isLoading: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });
  describe('blocked-submit guards', () => {
    it('LP-blocked provisioned submit does not call either save path via programmatic submit', async () => {
      const { mockSave } = setupRepoState({ isProvisioned: true });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      // Wait a tick, then assert neither path was called
      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('read-only provisioned submit does not call either save path via programmatic submit', async () => {
      const { mockSave } = setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('orphaned folder programmatic submit does not call standard API', async () => {
      setupRepoState({ isOrphaned: true });
      renderOverview();

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('loading state programmatic submit does not call standard API', async () => {
      setupRepoState({ isLoading: true });
      renderOverview();

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });
  });

  it('error state programmatic submit does not call standard API', async () => {
    setupRepoState({ isError: true });
    renderOverview();

    const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(saveDashboard).not.toHaveBeenCalled();
    });
  });

  describe('orphaned folder banner', () => {
    it('renders repository-not-found banner when folder is orphaned', async () => {
      setupRepoState({ isOrphaned: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByText(/Repository not found/i)).toBeInTheDocument();
      });
    });
  });
});
