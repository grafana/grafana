import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import {
  defaultSpec,
  defaultGridLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import {
  useGetResourceRepositoryView,
  RepoViewStatus,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardInputs, DashboardSource, InputType } from '../../types';
import { useImportProvisionedSave } from '../hooks/useImportProvisionedSave';

import { ImportOverviewV2 } from './ImportOverviewV2';

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
    onChange: (val: string, title: string) => void;
  }) => <input data-testid="folder-picker" value={value} onChange={(e) => onChange?.(e.target.value, 'Test Folder')} />,
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({
    onChange,
    pluginId,
    current,
  }: {
    onChange: (ds: { uid: string; type: string; name: string }) => void;
    pluginId: string;
    current?: { uid: string; type: string };
  }) => (
    <input
      data-testid={`datasource-picker-${pluginId}`}
      value={current?.uid || ''}
      onChange={(e) =>
        onChange({
          uid: e.target.value,
          type: pluginId,
          name: `${pluginId} instance`,
        })
      }
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

const mockRepository: RepositoryView = {
  name: 'test-repo',
  branch: 'main',
  type: 'github',
  target: 'folder',
  title: 'Test Repo',
  workflows: ['write', 'branch'],
};
describe('ImportOverviewV2', () => {
  let saveDashboard = jest.fn().mockResolvedValue({ url: '/d/test-uid/test-dashboard' });

  const mockInputs: DashboardInputs = {
    dataSources: [
      {
        name: 'Prometheus',
        pluginId: 'prometheus',
        type: InputType.DataSource,
        description: 'Select a Prometheus data source',
        info: 'Select prometheus',
        label: 'Prometheus',
        value: '',
      },
    ],
    constants: [],
    libraryPanels: [],
  };

  function renderCmp(layout: DashboardV2Spec['layout'], dashboardUid?: string) {
    const dashboard: DashboardV2Spec = { ...defaultSpec(), title: 'Test Dashboard', layout };
    render(
      <ImportOverviewV2
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={mockInputs}
        meta={{ updatedAt: '', orgName: '' }}
        source={DashboardSource.Json}
        folderUid="test-folder"
        onCancel={jest.fn()}
      />
    );
  }

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

    // Default: non-provisioned mode for existing tests
    mockUseGetResourceRepositoryView.mockReturnValue({
      status: RepoViewStatus.Ready,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });
    mockUseImportProvisionedSave.mockReturnValue({
      save: jest.fn(),
      isLoading: false,
      error: undefined,
    });
  });

  describe('float grid items warning', () => {
    it('does not show warning when dashboard has no float grid items', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 0,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      await waitFor(() => {
        expect(
          screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)
        ).not.toBeInTheDocument();
      });
    });

    it('shows warning when dashboard has float grid items', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 1.5,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      await waitFor(() => {
        expect(
          screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)
        ).toBeInTheDocument();
      });
    });
  });

  describe('onSubmit', () => {
    let user = userEvent.setup();

    beforeEach(() => {
      user = userEvent.setup();
    });

    it('truncates float grid items before saving', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 1.7,
            y: 2.3,
            width: 12.5,
            height: 8.9,
          },
        },
      ];

      renderCmp(layout);
      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));
      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      const savedLayout = savedData.dashboard.layout;
      // Math.trunc truncates toward zero (same as Go's int())
      expect(savedLayout.spec.items[0].spec.x).toBe(1);
      expect(savedLayout.spec.items[0].spec.y).toBe(2);
      expect(savedLayout.spec.items[0].spec.width).toBe(12);
      expect(savedLayout.spec.items[0].spec.height).toBe(8);
    });

    it('preserves grid items when there are no floats', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 0,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));
      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      const savedLayout = savedData.dashboard.layout;
      expect(savedLayout.spec.items[0].spec.x).toBe(0);
      expect(savedLayout.spec.items[0].spec.y).toBe(0);
      expect(savedLayout.spec.items[0].spec.width).toBe(12);
      expect(savedLayout.spec.items[0].spec.height).toBe(8);
    });

    it('sends preserved resource uid in k8s.name when provided', async () => {
      const layout = defaultGridLayoutKind();
      renderCmp(layout, 'resource-uid');

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      expect(savedData.k8s?.name).toBe('resource-uid');
    });

    it('allows overriding preserved uid before save', async () => {
      const layout = defaultGridLayoutKind();
      renderCmp(layout, 'resource-uid');

      await user.click(screen.getByRole('button', { name: /change uid/i }));

      const uidField = document.querySelector('input[name="k8s.name"]') as HTMLInputElement;
      await user.clear(uidField);
      await user.type(uidField, 'custom-uid');

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      expect(savedData.k8s?.name).toBe('custom-uid');
    });
  });

  describe('provisioned mode', () => {
    function setupProvisioned() {
      const mockSave = jest.fn();
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        status: RepoViewStatus.Ready,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });
      mockUseImportProvisionedSave.mockReturnValue({
        save: mockSave,
        isLoading: false,
        error: undefined,
      });
      return { mockSave };
    }

    it('renders ResourceEditFormSharedFields when folder is repo-managed', async () => {
      setupProvisioned();
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByTestId('resource-edit-shared-fields')).toBeInTheDocument();
      });
    });

    it('submits via provisioned save hook', async () => {
      const { mockSave } = setupProvisioned();
      const user = userEvent.setup();
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith(
          expect.objectContaining({
            apiVersion: 'v2',
            title: 'Test Dashboard',
          })
        );
      });
    });

    it('does not call standard API in provisioned mode', async () => {
      setupProvisioned();
      const user = userEvent.setup();
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('renders RepoInvalidStateBanner when repo is read-only', async () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        status: RepoViewStatus.Ready,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: true,
      });
      mockUseImportProvisionedSave.mockReturnValue({
        save: jest.fn(),
        isLoading: false,
        error: undefined,
      });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        const banner = screen.getByTestId('repo-invalid-banner');
        expect(banner).toHaveAttribute('data-read-only', 'true');
      });
    });

    it('disables submit when repo is read-only', async () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        status: RepoViewStatus.Ready,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: true,
      });
      mockUseImportProvisionedSave.mockReturnValue({
        save: jest.fn(),
        isLoading: false,
        error: undefined,
      });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });
});
