import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  defaultSpec,
  defaultGridLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { type DashboardInputs, DashboardSource, InputType } from '../../types';
import { useImportProvisionedSave } from '../hooks/useImportProvisionedSave';

import { ImportOverviewV2 } from './ImportOverviewV2';

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

    // Default: non-provisioned mode
    setupRepoState({ isProvisioned: false });
  });

  afterEach(() => {
    config.featureToggles.provisioning = false;
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
    it('renders ResourceEditFormSharedFields when folder is repo-managed', async () => {
      setupRepoState({ isProvisioned: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });
    });

    it('submits via provisioned save hook', async () => {
      const { mockSave } = setupRepoState({ isProvisioned: true });
      const user = userEvent.setup();
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      // Wait for provisioning state to resolve
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });

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
      setupRepoState({ isProvisioned: true });
      const user = userEvent.setup();
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      });

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('renders read-only banner when repo is read-only', async () => {
      setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByText(/This repository is read only/i)).toBeInTheDocument();
      });
    });

    it('disables submit when repo is read-only', async () => {
      setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
    });
  });

  describe('blocked-submit guards', () => {
    it('read-only provisioned submit does not call either save path via programmatic submit', async () => {
      const { mockSave } = setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

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
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('loading state programmatic submit does not call standard API', async () => {
      setupRepoState({ isLoading: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });

    it('error state programmatic submit does not call standard API', async () => {
      setupRepoState({ isError: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const form = screen.getByTestId(selectors.components.ImportDashboardForm.submit).closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(saveDashboard).not.toHaveBeenCalled();
      });
    });
  });

  describe('orphaned folder banner', () => {
    it('renders repository-not-found banner when folder is orphaned', async () => {
      setupRepoState({ isOrphaned: true });
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      await waitFor(() => {
        expect(screen.getByText(/Repository not found/i)).toBeInTheDocument();
      });
    });
  });
});
