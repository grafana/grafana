import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { type Dashboard } from '@grafana/schema';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import {
  useGetResourceRepositoryView,
  RepoViewStatus,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

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

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
  RepoViewStatus: {
    Disabled: 'disabled',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
    Orphaned: 'orphaned',
  },
}));

jest.mock('../hooks/useImportProvisionedSave', () => ({
  useImportProvisionedSave: jest.fn(),
}));

jest.mock('app/features/provisioning/components/Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="resource-edit-shared-fields" />,
}));

jest.mock('app/features/provisioning/components/Shared/RepoInvalidStateBanner', () => ({
  RepoInvalidStateBanner: ({ noRepository, isReadOnlyRepo }: { noRepository: boolean; isReadOnlyRepo: boolean }) => (
    <div data-testid="repo-invalid-banner" data-no-repo={noRepository} data-read-only={isReadOnlyRepo} />
  ),
}));

jest.mock('app/features/provisioning/Shared/ProvisioningAlert', () => ({
  ProvisioningAlert: ({ error }: { error: string }) => <div data-testid="provisioning-alert">{error}</div>,
}));

jest.mock('app/features/provisioning/components/defaults', () => ({
  getDefaultWorkflow: jest.fn().mockReturnValue('write'),
  getDefaultRef: jest.fn().mockReturnValue('main'),
  getCanPushToConfiguredBranch: jest.fn().mockReturnValue(true),
}));

jest.mock('app/features/provisioning/components/utils/path', () => ({
  generatePath: jest.fn().mockReturnValue('test-dashboard.json'),
  slugifyForFilename: jest.fn().mockReturnValue('test-dashboard'),
  splitPath: jest.fn().mockReturnValue({ directory: '', filename: 'test-dashboard.json' }),
  joinPath: jest.fn((_dir: string, file: string) => file),
}));

jest.mock('app/features/provisioning/components/utils/timestamp', () => ({
  generateTimestamp: jest.fn().mockReturnValue('2026-05-04-abc12'),
}));

const mockGetDashboardAPI = jest.mocked(getDashboardAPI);
const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseImportProvisionedSave = jest.mocked(useImportProvisionedSave);

// --- Helpers ---

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

function setupMocks({
  isProvisioned = false,
  isReadOnlyRepo = false,
  isOrphaned = false,
  isLoading = false,
}: {
  isProvisioned?: boolean;
  isReadOnlyRepo?: boolean;
  isOrphaned?: boolean;
  isLoading?: boolean;
} = {}) {
  const mockSave = jest.fn();
  mockUseImportProvisionedSave.mockReturnValue({
    save: mockSave,
    isLoading: false,
    error: undefined,
  });

  if (isLoading) {
    mockUseGetResourceRepositoryView.mockReturnValue({
      status: RepoViewStatus.Loading,
      isLoading: true,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });
  } else if (isOrphaned) {
    mockUseGetResourceRepositoryView.mockReturnValue({
      status: RepoViewStatus.Orphaned,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      orphanedRepoName: 'dead-repo',
    });
  } else if (isProvisioned) {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: mockRepository,
      status: RepoViewStatus.Ready,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo,
    });
  } else {
    mockUseGetResourceRepositoryView.mockReturnValue({
      status: RepoViewStatus.Ready,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });
  }

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

  describe('standard (non-provisioned) path', () => {
    it('renders the import form', async () => {
      setupMocks({ isProvisioned: false });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      });
    });

    it('does not render provisioning shared fields', async () => {
      setupMocks({ isProvisioned: false });
      renderOverview();

      await waitFor(() => {
        expect(screen.queryByTestId('resource-edit-shared-fields')).not.toBeInTheDocument();
      });
    });

    it('submits via standard API', async () => {
      setupMocks({ isProvisioned: false });
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
      setupMocks({ isProvisioned: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId('resource-edit-shared-fields')).toBeInTheDocument();
      });
    });

    it('submits via provisioned save hook', async () => {
      const { mockSave } = setupMocks({ isProvisioned: true });
      renderOverview();
      const user = userEvent.setup();

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
      setupMocks({ isProvisioned: true });
      renderOverview();
      const user = userEvent.setup();

      await user.click(screen.getByTestId(selectors.components.ImportDashboardForm.submit));

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });
  });

  describe('library panel block', () => {
    it('disables submit when LP inputs exist and folder is provisioned', async () => {
      setupMocks({ isProvisioned: true });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
        expect(submitBtn).toBeDisabled();
      });
    });

    it('shows LP blocked alert when folder is provisioned', async () => {
      setupMocks({ isProvisioned: true });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        expect(screen.getByText(/library panels not supported/i)).toBeInTheDocument();
      });
    });

    it('does not show LP alert in non-provisioned mode', async () => {
      setupMocks({ isProvisioned: false });
      renderOverview(inputsWithLP);

      await waitFor(() => {
        expect(screen.queryByText(/library panels not supported/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('read-only repo', () => {
    it('renders RepoInvalidStateBanner when repo is read-only', async () => {
      setupMocks({ isProvisioned: true, isReadOnlyRepo: true });
      renderOverview();

      await waitFor(() => {
        const banner = screen.getByTestId('repo-invalid-banner');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveAttribute('data-read-only', 'true');
      });
    });

    it('disables submit when repo is read-only', async () => {
      setupMocks({ isProvisioned: true, isReadOnlyRepo: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });

  describe('orphaned folder', () => {
    it('disables submit when folder is orphaned', async () => {
      setupMocks({ isOrphaned: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });

  describe('loading state', () => {
    it('disables submit while repository is loading', async () => {
      setupMocks({ isLoading: true });
      renderOverview();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });
});
