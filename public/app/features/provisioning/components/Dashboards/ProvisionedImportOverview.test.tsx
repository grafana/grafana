import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardInputs, DashboardSource, LibraryPanelInputState } from 'app/features/manage-dashboards/types';

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

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => jest.fn(),
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="shared-fields">Shared Fields</div>,
}));

jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: {
    validateNewDashboardName: jest.fn().mockResolvedValue(true),
  },
}));

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

function setup(overrides: Partial<Parameters<typeof ProvisionedImportOverview>[0]> = {}) {
  const props = {
    dashboard: v1Dashboard,
    dashboardUid: 'test-uid',
    inputs: emptyInputs,
    meta: { updatedAt: '2024-01-01', orgName: 'Test Org' },
    source: DashboardSource.Json,
    folderUid: 'folder-1',
    repository,
    onCancel: jest.fn(),
    ...overrides,
  };

  return { ...render(<ProvisionedImportOverview {...props} />), props };
}

describe('ProvisionedImportOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dashboardAPIVersionResolver.set({ v1: 'v1', v2: 'v2' });
  });

  describe('rendering', () => {
    it('renders name and uid fields', () => {
      setup();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.name)).toBeInTheDocument();
      expect(screen.getByTestId('provisioned-import-uid')).toBeInTheDocument();
    });

    it('renders shared provisioning fields', () => {
      setup();
      expect(screen.getByTestId('shared-fields')).toBeInTheDocument();
    });

    it('renders import button', () => {
      setup();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toHaveTextContent('Import');
    });

    it('pre-fills title from dashboard', () => {
      setup();
      const nameInput = screen.getByTestId(selectors.components.ImportDashboardForm.name);
      expect(nameInput).toHaveValue('V1 Dashboard');
    });
  });

  describe('V1 dashboard', () => {
    it('calls save with v1 apiVersion on submit', async () => {
      setup();
      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);

      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });

      const call = mockSave.mock.calls[0][0];
      expect(call.apiVersion).toBe('v1');
      expect(call.folderUid).toBe('folder-1');
      expect(call.title).toBe('V1 Dashboard');
    });
  });

  describe('V2 dashboard', () => {
    it('calls save with v2 apiVersion on submit', async () => {
      setup({ dashboard: v2Dashboard, dashboardUid: 'v2-uid' });
      const submitBtn = screen.getByTestId(selectors.components.ImportDashboardForm.submit);

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

      setup({ dashboard: floatDashboard });

      expect(screen.getByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)).toBeInTheDocument();
    });
  });

  describe('library panels block', () => {
    it('shows warning and disables submit for V1 dashboard with library panels', () => {
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

      setup({ inputs: inputsWithLibPanels });

      expect(screen.getByText(/library panels not supported/i)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
    });

    it('does NOT block submit for V2 dashboard with library panels', () => {
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

      setup({ dashboard: v2Dashboard, inputs: inputsWithLibPanels });

      expect(screen.queryByText(/library panels not supported/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).not.toBeDisabled();
    });
  });

  describe('read-only repo', () => {
    it('shows read-only banner and disables submit', () => {
      const readOnlyRepo: RepositoryView = {
        ...repository,
        workflows: [],
      };

      setup({ repository: readOnlyRepo });

      expect(screen.getByText(/read only/i)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.ImportDashboardForm.submit)).toBeDisabled();
    });
  });

  describe('gcom source', () => {
    it('shows GcomDashboardInfo when source is Gcom', () => {
      setup({ source: DashboardSource.Gcom });
      // GcomDashboardInfo renders orgName info
      expect(screen.getByText(/Test Org/)).toBeInTheDocument();
    });
  });
});
