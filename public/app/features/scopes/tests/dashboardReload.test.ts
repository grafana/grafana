import { config } from '@grafana/runtime';

import { enterEditMode, updateMyVar, updateMyVar2, updateScopes, updateTimeRange } from './utils/actions';
import { expectDashboardReload, expectNotDashboardReload } from './utils/assertions';
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

describe('Dashboard reload', () => {
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  afterEach(async () => {
    await resetScenes();
  });

  describe('Reload on scopes change', () => {
    it('Does not reload the dashboard without UID', async () => {
      renderDashboard({ uid: undefined }, { reloadOnScopesChange: true });
      await updateScopes(['grafana']);
      expectNotDashboardReload();
    });

    it('Reloads the dashboard with UID', async () => {
      renderDashboard({}, { reloadOnScopesChange: true });
      await updateScopes(['grafana']);
      expectDashboardReload();
    });
  });

  describe('Reload on time range change', () => {
    it('Does not reload the dashboard without UID', async () => {
      const dashboardScene = renderDashboard({ uid: undefined }, { reloadOnTimeRangeChange: true });
      await updateTimeRange(dashboardScene);
      expectNotDashboardReload();
    });

    it('Reloads the dashboard with UID', async () => {
      const dashboardScene = renderDashboard({}, { reloadOnTimeRangeChange: true });
      await updateTimeRange(dashboardScene);
      expectDashboardReload();
    });
  });

  describe('Reload on scope filters change', () => {
    describe('All filters', () => {
      it('Does not reload the dashboard without UID', async () => {
        const dashboardScene = renderDashboard({ uid: undefined }, { reloadOnFiltersChange: true });
        await updateMyVar(dashboardScene, '2');
        expectNotDashboardReload();
      });

      it('Does not reload if the dashboard is in edit mode', async () => {
        const dashboardScene = renderDashboard({}, { reloadOnFiltersChange: true });
        await enterEditMode(dashboardScene);
        await updateMyVar(dashboardScene, '2');
        expectNotDashboardReload();
      });

      it('Reloads the dashboard with UID', async () => {
        const dashboardScene = renderDashboard({}, { reloadOnFiltersChange: true });
        await updateMyVar(dashboardScene, '2');
        expectDashboardReload();
      });
    });

    describe('Some filters', () => {
      it('Does not reload the dashboard without UID', async () => {
        const dashboardScene = renderDashboard({ uid: undefined }, { reloadOnFiltersChange: ['myVar'] });
        await updateMyVar(dashboardScene, '2');
        expectNotDashboardReload();
      });

      it('Does not reload if the dashboard is in edit mode', async () => {
        const dashboardScene = renderDashboard({}, { reloadOnFiltersChange: ['myVar'] });
        await enterEditMode(dashboardScene);
        await updateMyVar(dashboardScene, '2');
        expectNotDashboardReload();
      });

      it('Does not reload if another variable is updated', async () => {
        const dashboardScene = renderDashboard({}, { reloadOnFiltersChange: ['myVar'] });
        await updateMyVar2(dashboardScene, '2');
        expectNotDashboardReload();
      });

      it('Reloads the dashboard with UID', async () => {
        const dashboardScene = renderDashboard({}, { reloadOnFiltersChange: ['myVar'] });
        await updateMyVar(dashboardScene, '2');
        expectDashboardReload();
      });
    });
  });
});
