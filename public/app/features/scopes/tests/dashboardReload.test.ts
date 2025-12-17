import { config } from '@grafana/runtime';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

import { enterEditMode, updateMyVar, updateScopes, updateTimeRange } from './utils/actions';
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

jest.mock('../ScopesApiClient', () => ({
  ScopesApiClient: jest.fn().mockImplementation(() => ({
    fetchScope: jest.fn().mockImplementation((name: string) => {
      const { mocksScopes } = jest.requireActual('./utils/mocks');
      return Promise.resolve(mocksScopes.find((s: { metadata: { name: string } }) => s.metadata.name === name));
    }),
    fetchMultipleScopes: jest.fn().mockImplementation((names: string[]) => {
      const { mocksScopes } = jest.requireActual('./utils/mocks');
      return Promise.resolve(
        names
          .map((name) => mocksScopes.find((s: { metadata: { name: string } }) => s.metadata.name === name))
          .filter(Boolean)
      );
    }),
    fetchMultipleScopeNodes: jest.fn().mockResolvedValue([]),
    fetchNodes: jest.fn().mockImplementation((options: { parent?: string; query?: string }) => {
      const { mocksNodes } = jest.requireActual('./utils/mocks');
      return Promise.resolve(
        mocksNodes.filter(
          (node: { spec: { parentName: string; title: string } }) =>
            node.spec.parentName === (options.parent ?? '') &&
            node.spec.title.toLowerCase().includes((options.query ?? '').toLowerCase())
        )
      );
    }),
    fetchDashboards: jest.fn().mockImplementation((scopeNames: string[]) => {
      const { mocksScopeDashboardBindings } = jest.requireActual('./utils/mocks');
      return Promise.resolve(
        mocksScopeDashboardBindings.filter((b: { spec: { scope: string } }) => scopeNames.includes(b.spec.scope))
      );
    }),
    fetchScopeNavigations: jest.fn().mockResolvedValue([]),
    fetchScopeNode: jest.fn().mockImplementation((name: string) => {
      const { mocksNodes } = jest.requireActual('./utils/mocks');
      return Promise.resolve(mocksNodes.find((n: { metadata: { name: string } }) => n.metadata.name === name));
    }),
  })),
}));

describe('Dashboard reload', () => {
  let dashboardReloadSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  it.each([
    [false, false, false, false],
    [false, false, true, false],
    [false, true, false, false],
    [false, true, true, false],
    [true, false, false, false],
    [true, false, true, false],
    [true, true, false, true],
    [true, true, true, true],
    [true, true, false, false],
    [true, true, true, false],
  ])(
    `reloadDashboardsOnParamsChange: %s, reloadOnParamsChange: %s, withUid: %s, editMode: %s`,
    async (reloadDashboardsOnParamsChange, reloadOnParamsChange, withUid, editMode) => {
      config.featureToggles.reloadDashboardsOnParamsChange = reloadDashboardsOnParamsChange;
      setDashboardAPI(undefined);

      const { scene: dashboardScene, scopesService } = await renderDashboard(
        { uid: withUid ? 'dash-1' : undefined },
        { reloadOnParamsChange }
      );

      dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');

      if (editMode) {
        await enterEditMode(dashboardScene);
      }

      const shouldReload = reloadDashboardsOnParamsChange && reloadOnParamsChange && withUid && !editMode;
      dashboardReloadSpy.mockClear();

      await updateTimeRange(dashboardScene);
      await jest.advanceTimersToNextTimerAsync();
      if (!shouldReload) {
        expect(dashboardReloadSpy).not.toHaveBeenCalled();
      } else {
        expect(dashboardReloadSpy).toHaveBeenCalled();
      }

      await updateMyVar(dashboardScene, '2');
      await jest.advanceTimersToNextTimerAsync();
      if (!shouldReload) {
        expect(dashboardReloadSpy).not.toHaveBeenCalled();
      } else {
        expect(dashboardReloadSpy).toHaveBeenCalled();
      }

      await updateScopes(scopesService, ['grafana']);
      await jest.advanceTimersToNextTimerAsync();
      if (!shouldReload) {
        expect(dashboardReloadSpy).not.toHaveBeenCalled();
      } else {
        expect(dashboardReloadSpy).toHaveBeenCalled();
      }

      getDashboardScenePageStateManager().clearDashboardCache();
      getDashboardScenePageStateManager().clearSceneCache();
      setDashboardAPI(undefined);
      await resetScenes([dashboardReloadSpy]);
    }
  );
});
