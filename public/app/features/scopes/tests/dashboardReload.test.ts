import { BackendSrvRequest, config } from '@grafana/runtime';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { enterEditMode, getDashboardDTO, updateMyVar, updateScopes, updateTimeRange } from './utils/actions';
import {
  expectDashboardReload,
  expectNewDashboardDTO,
  expectNotDashboardReload,
  expectOldDashboardDTO,
} from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

const runTest = async (
  reloadDashboardsOnParamsChange: boolean,
  kubernetesApi: boolean,
  params: BackendSrvRequest['params']
) => {
  config.featureToggles.scopeFilters = true;
  config.featureToggles.reloadDashboardsOnParamsChange = reloadDashboardsOnParamsChange;
  config.featureToggles.kubernetesDashboards = kubernetesApi;
  setDashboardAPI(undefined);
  renderDashboard({}, { reloadOnParamsChange: true });
  await updateScopes(['grafana', 'mimir']);
  await getDashboardDTO();

  if (kubernetesApi) {
    return expectNewDashboardDTO();
  }

  if (reloadDashboardsOnParamsChange) {
    return expectOldDashboardDTO(['grafana', 'mimir']);
  }

  return expectOldDashboardDTO();
};

describe('Dashboard reload', () => {
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
    config.featureToggles.reloadDashboardsOnParamsChange = true;
  });

  afterEach(async () => {
    setDashboardAPI(undefined);
    await resetScenes();
  });

  describe('Reload on scopes change', () => {
    it('Does not reload the dashboard without UID', async () => {
      renderDashboard({ uid: undefined }, { reloadOnParamsChange: true });
      await updateScopes(['grafana']);
      expectNotDashboardReload();
    });

    it('Reloads the dashboard with UID', async () => {
      renderDashboard({}, { reloadOnParamsChange: true });
      await updateScopes(['grafana']);
      expectDashboardReload();
    });
  });

  describe('Reload on time range change', () => {
    it('Does not reload the dashboard without UID', async () => {
      const dashboardScene = renderDashboard({ uid: undefined }, { reloadOnParamsChange: true });
      await updateTimeRange(dashboardScene);
      expectNotDashboardReload();
    });

    it('Reloads the dashboard with UID', async () => {
      const dashboardScene = renderDashboard({}, { reloadOnParamsChange: true });
      await updateTimeRange(dashboardScene);
      expectDashboardReload();
    });
  });

  describe('Reload on scope filters change', () => {
    it('Does not reload the dashboard without UID', async () => {
      const dashboardScene = renderDashboard({ uid: undefined }, { reloadOnParamsChange: true });
      await updateMyVar(dashboardScene, '2');
      expectNotDashboardReload();
    });

    it('Does not reload if the dashboard is in edit mode', async () => {
      const dashboardScene = renderDashboard({}, { reloadOnParamsChange: true });
      await enterEditMode(dashboardScene);
      await updateMyVar(dashboardScene, '2');
      expectNotDashboardReload();
    });

    it('Reloads the dashboard with UID', async () => {
      const dashboardScene = renderDashboard({}, { reloadOnParamsChange: true });
      await updateMyVar(dashboardScene, '2');
      expectDashboardReload();
    });
  });
});
