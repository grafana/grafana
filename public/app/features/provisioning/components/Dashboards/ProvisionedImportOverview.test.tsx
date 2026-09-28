import { act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { validateUid } from 'app/features/manage-dashboards/import/utils/validation';
import {
  type DashboardInputs,
  DashboardSource,
  InputType,
  LibraryPanelInputState,
} from 'app/features/manage-dashboards/types';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';

import { ProvisionedImportOverview } from './ProvisionedImportOverview';

setupProvisioningMswServer();

const mockSave = jest.fn();
jest.mock('../../hooks/useImportProvisionedSave', () => ({
  useImportProvisionedSave: () => ({
    save: mockSave,
    isLoading: false,
    error: undefined,
  }),
}));

jest.mock('../Shared/ProvisioningAwareFolderPicker', () => ({
  ProvisioningAwareFolderPicker: ({ onChange }: { onChange: (uid?: string, title?: string) => void }) => (
    <button type="button" data-testid="grafana-folder-picker" onClick={() => onChange('switched-folder', 'Switched')}>
      Folder picker
    </button>
  ),
}));

jest.mock('app/features/manage-dashboards/import/utils/validation', () => ({
  validateUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

// Render the datasource picker as a button that selects a fixed datasource, so a
// V1 import with datasource inputs can be exercised without the real picker.
jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({ onChange }: { onChange: (ds: { uid: string; type: string; name: string }) => void }) => (
    <button
      type="button"
      data-testid="mock-datasource-picker"
      onClick={() => onChange({ uid: 'prom-uid', type: 'prometheus', name: 'Prometheus' })}
    >
      Datasource picker
    </button>
  ),
}));

const mockValidateUid = jest.mocked(validateUid);
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

const repository: RepositoryView = {
  name: 'test-repo',
  type: 'github',
  target: 'folder',
  title: 'Test Repository',
  branch: 'main',
  workflows: ['write', 'branch'],
};

const emptyInputs: DashboardInputs = {
  dataSources: [],
  constants: [],
  libraryPanels: [],
};

const v1Dashboard: Dashboard = {
  title: 'V1 Dashboard',
  uid: 'v1-uid',
  schemaVersion: 1,
  panels: [],
};

const v2Dashboard: DashboardV2Spec = {
  title: 'V2 Dashboard',
  description: '',
  cursorSync: 'Off',
  liveNow: false,
  preload: false,
  tags: [],
  timeSettings: {
    timezone: 'browser',
    from: 'now-6h',
    to: 'now',
    autoRefresh: '',
    autoRefreshIntervals: [],
    hideTimepicker: false,
    weekStart: undefined,
    fiscalYearStartMonth: 0,
    nowDelay: '',
    quickRanges: [],
  },
  links: [],
  annotations: [],
  variables: [],
  elements: {},
  layout: { kind: 'GridLayout', spec: { items: [] } },
};

async function setup(overrides: Partial<Parameters<typeof ProvisionedImportOverview>[0]> = {}) {
  const props = {
    dashboard: v1Dashboard,
    dashboardUid: 'test-uid',
    inputs: emptyInputs,
    meta: { updatedAt: '2024-01-01', orgName: 'Test Org' },
    source: DashboardSource.Json,
    folderUid: 'folder-1',
    status: RepoViewStatus.Ready,
    repository,
    onCancel: jest.fn(),
    onFolderChange: jest.fn(),
    ...overrides,
  };

  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProvisionedImportOverview {...props} />);
  });

  return { ...result, props };
}

describe('ProvisionedImportOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockReturnValue(undefined);
    mockValidateUid.mockResolvedValue(true);
    dashboardAPIVersionResolver.set({ v1: 'v1', v2: 'v2' });
    server.use(
      http.get(`${BASE}/repositories/:name/files/*`, () => {
        return new HttpResponse(null, { status: 404 });
      })
    );
  });

  describe('rendering', () => {
    it('renders name and uid fields', async () => {
      await setup();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.name)).toBeInTheDocument();
      expect(screen.getByTestId('provisioned-import-uid')).toBeInTheDocument();
    });

    it('renders shared provisioning fields', async () => {
      await setup();
      expect(await screen.findByRole('combobox', { name: /branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
    });

    it('renders the persistent Grafana folder picker', async () => {
      await setup();
      expect(screen.getByTestId('grafana-folder-picker')).toBeInTheDocument();
    });

    it('renders name before the Grafana folder picker', async () => {
      await setup();
      const nameInput = screen.getByTestId(selectors.components.ImportDashboardForm.name);
      const folderPicker = screen.getByTestId('grafana-folder-picker');
      expect(nameInput.compareDocumentPosition(folderPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('calls onFolderChange when the Grafana folder picker changes', async () => {
      const { props } = await setup();
      await userEvent.click(screen.getByTestId('grafana-folder-picker'));
      expect(props.onFolderChange).toHaveBeenCalledWith('switched-folder');
    });

    it('renders import button', async () => {
      await setup();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toHaveTextContent('Import');
    });

    it('pre-fills title from dashboard', async () => {
      await setup();
      const nameInput = screen.getByTestId(selectors.components.ImportDashboardForm.name);
      expect(nameInput).toHaveValue('V1 Dashboard');
    });
  });

  describe('V1 dashboard', () => {
    it('calls save with v1 apiVersion on submit', async () => {
      await setup();
      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });

      const call = mockSave.mock.calls[0][0];
      expect(call.apiVersion).toBe('v1');
      expect(call.folderUid).toBe('folder-1');
      expect(call.title).toBe('V1 Dashboard');
    });

    it('resolves selected datasource instance settings before saving', async () => {
      const promSettings = {
        uid: 'prom-uid',
        type: 'prometheus',
        name: 'Prometheus',
      } as DataSourceInstanceSettings;
      mockGetDataSourceInstanceSettings.mockResolvedValue(promSettings);

      const inputsWithDataSource: DashboardInputs = {
        ...emptyInputs,
        dataSources: [
          {
            name: 'DS_PROM',
            label: 'Prometheus',
            info: 'Select a Prometheus data source',
            value: '',
            type: InputType.DataSource,
            pluginId: 'prometheus',
          },
        ],
      };

      await setup({ inputs: inputsWithDataSource });

      await userEvent.click(screen.getByTestId('mock-datasource-picker'));

      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      await userEvent.click(submitBtn);

      await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
      expect(mockGetDataSourceInstanceSettings).toHaveBeenCalledWith('prom-uid');
    });

    it('disables submit synchronously and stays disabled while save is pending', async () => {
      let resolveSave!: () => void;
      mockSave.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
      );
      await setup({ dashboardUid: undefined });

      const nameInput = screen.getByTestId(selectors.components.ImportDashboardForm.name);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Imported dashboard');

      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
      await waitFor(() => expect(submitBtn).not.toBeDisabled());

      fireEvent.click(submitBtn);

      expect(submitBtn).toBeDisabled();

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(submitBtn).toBeDisabled();

      await act(async () => {
        resolveSave();
        await Promise.resolve();
      });
    });
  });

  describe('V2 dashboard', () => {
    it('calls save with v2 apiVersion on submit', async () => {
      await setup({ dashboard: v2Dashboard, dashboardUid: 'v2-uid' });
      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
      await waitFor(() => expect(submitBtn).not.toBeDisabled());
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });

      const call = mockSave.mock.calls[0][0];
      expect(call.apiVersion).toBe('v2');
      expect(call.title).toBe('V2 Dashboard');
    });

    it('shows float-grid items alert when dashboard has floating positions', async () => {
      const floatDashboard: DashboardV2Spec = {
        ...v2Dashboard,
        layout: {
          kind: 'GridLayout',
          spec: {
            items: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  x: 0.5,
                  y: 1.2,
                  width: 12,
                  height: 8,
                  element: { kind: 'ElementReference', name: 'panel-1' },
                },
              },
            ],
          },
        },
      };

      await setup({ dashboard: floatDashboard });

      expect(screen.getByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)).toBeInTheDocument();
    });
  });

  describe('library panels block', () => {
    it('shows warning and disables submit for V1 dashboard with library panels', async () => {
      const inputsWithLibPanels: DashboardInputs = {
        ...emptyInputs,
        libraryPanels: [
          {
            model: {
              uid: 'lp-1',
              name: 'My Panel',
              model: { type: 'timeseries' },
              version: 1,
              type: 'timeseries',
              description: '',
            },
            state: LibraryPanelInputState.New,
          },
        ],
      };

      await setup({ inputs: inputsWithLibPanels });

      expect(screen.getByText(/library panels not supported/i)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
    });

    it('does NOT block submit for V2 dashboard with library panels', async () => {
      const inputsWithLibPanels: DashboardInputs = {
        ...emptyInputs,
        libraryPanels: [
          {
            model: {
              uid: 'lp-1',
              name: 'My Panel',
              model: { type: 'timeseries' },
              version: 1,
              type: 'timeseries',
              description: '',
            },
            state: LibraryPanelInputState.New,
          },
        ],
      };

      await setup({ dashboard: v2Dashboard, inputs: inputsWithLibPanels });

      expect(screen.queryByText(/library panels not supported/i)).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeDisabled()
      );
    });
  });

  describe('read-only repo', () => {
    it('shows read-only banner and disables submit', async () => {
      const readOnlyRepo: RepositoryView = {
        ...repository,
        workflows: [],
      };

      await setup({ repository: readOnlyRepo });

      expect(screen.getByText(/read only/i)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
    });
  });

  describe('gcom source', () => {
    it('shows GcomDashboardInfo when source is Gcom', async () => {
      await setup({ source: DashboardSource.Gcom });
      // GcomDashboardInfo renders orgName info
      expect(screen.getByText(/Test Org/)).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('allows duplicate titles for provisioned import', async () => {
      await setup();

      // Title field is pre-filled with a value; submit should be enabled
      // regardless of whether another dashboard with the same title exists,
      // because provisioned imports use repository file path as the uniqueness constraint.
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeDisabled()
      );
    });

    it('disables submit when uid already exists', async () => {
      mockValidateUid.mockResolvedValue("Dashboard named 'Other' in folder 'General' has the same UID");
      await setup();

      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      expect(screen.getByText(/has the same UID/)).toBeInTheDocument();
    });

    it('does not call uid validator when uid is empty', async () => {
      await setup({ dashboardUid: undefined });

      expect(mockValidateUid).not.toHaveBeenCalled();
    });

    it('triggers validation on mount for uid', async () => {
      await setup();

      expect(mockValidateUid).toHaveBeenCalledWith('test-uid');
    });

    it('allows submit when all validations pass', async () => {
      await setup();

      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeDisabled()
      );
    });

    it('disables submit when file already exists at target path', async () => {
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, () => {
          return HttpResponse.json({ path: 'existing-file.json' });
        })
      );
      await setup();

      await waitFor(() => {
        expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
      });
      expect(screen.getByText('A file with this name already exists at this path')).toBeInTheDocument();
    });

    it('keeps submit disabled until initial async validation completes', async () => {
      // RHF may call the validator multiple times (trigger + internal isValid recomputation),
      // so track all pending promises and resolve them together.
      const pendingResolvers: Array<(value: true | string) => void> = [];
      mockValidateUid.mockImplementation(
        () =>
          new Promise<true | string>((resolve) => {
            pendingResolvers.push(resolve);
          })
      );

      await setup();

      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);
      expect(submitBtn).toBeDisabled();

      await act(async () => {
        pendingResolvers.forEach((r) => r(true));
      });

      await waitFor(() => expect(submitBtn).not.toBeDisabled());
    });
  });

  describe('folder path in repo', () => {
    it('includes folder source path in the default file path', async () => {
      const folder = {
        metadata: {
          annotations: {
            [AnnoKeySourcePath]: 'dashboards/subfolder',
          },
        },
        spec: { title: 'subfolder' },
      } as unknown as Folder;

      await setup({ folder });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      expect(filenameInput).toHaveValue('v1-dashboard.json');
      // The full path should start with the folder source path
      const folderCombobox = screen.getByRole('combobox', { name: /repository folder/i });
      expect(folderCombobox).toHaveValue('dashboards/subfolder');
    });

    it('does not include folder prefix when folder has no AnnoKeySourcePath', async () => {
      await setup({ folder: undefined });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      expect(filenameInput).toHaveValue('v1-dashboard.json');
      const folderCombobox = screen.getByRole('combobox', { name: /repository folder/i });
      expect(folderCombobox).toHaveValue('');
    });

    it('renders the repository folder field with a distinct label', async () => {
      await setup();
      expect(screen.getByTestId('grafana-folder-picker')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /repository folder/i })).toBeInTheDocument();
    });
  });

  describe('provisioning status handling', () => {
    it('renders RepoInvalidStateBanner when status is Orphaned', async () => {
      await setup({ status: RepoViewStatus.Orphaned, repository: undefined });
      expect(screen.getByRole('alert', { name: /repository not found/i })).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeInTheDocument();
    });

    it('renders provisioning status error alert when status is Error', async () => {
      await setup({ status: RepoViewStatus.Error, repository: undefined });
      expect(screen.getByRole('alert', { name: /unable to determine provisioning status/i })).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeInTheDocument();
    });

    it('renders nothing for unexpected non-Ready status', async () => {
      const { container } = await setup({ status: RepoViewStatus.Disabled as RepoViewStatus, repository: undefined });
      expect(container).toBeEmptyDOMElement();
    });
  });
});
