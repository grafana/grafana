import { config, locationService } from '@grafana/runtime';

import { getDashboardScenePageStateManager } from '../../dashboard-scene/pages/DashboardScenePageStateManager';
import { ScopesService } from '../ScopesService';

import {
  applyScopes,
  cancelScopes,
  selectResultApplicationsMimir,
  selectResultApplicationsGrafana,
  openSelector,
  selectResultCloud,
  updateScopes,
  expandRecentScopes,
  expandResultApplications,
  selectRecentScope,
  clearSelector,
  hoverSelector,
} from './utils/actions';
import {
  expectRecentScope,
  expectRecentScopeNotPresent,
  expectRecentScopeNotPresentInDocument,
  expectRecentScopesSection,
  expectResultApplicationsGrafanaSelected,
  expectScopesSelectorValue,
} from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock, mocksScopes } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';
import { getListOfScopes } from './utils/selectors';

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
    fetchScopeNavigations: jest.fn().mockImplementation((scopeNames: string[]) => {
      const { subScopeMimirItems, subScopeLokiItems } = jest.requireActual('./utils/mocks');
      if (scopeNames.includes('mimir')) {
        return Promise.resolve(subScopeMimirItems);
      }
      if (scopeNames.includes('loki')) {
        return Promise.resolve(subScopeLokiItems);
      }
      return Promise.resolve([]);
    }),
    fetchScopeNode: jest.fn().mockImplementation((name: string) => {
      const { mocksNodes } = jest.requireActual('./utils/mocks');
      return Promise.resolve(mocksNodes.find((n: { metadata: { name: string } }) => n.metadata.name === name));
    }),
  })),
}));

describe('Selector', () => {
  let fetchSelectedScopesSpy: jest.SpyInstance;
  let dashboardReloadSpy: jest.SpyInstance;
  let scopesService: ScopesService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
    config.featureToggles.useScopeSingleNodeEndpoint = true;
  });

  beforeEach(async () => {
    const result = await renderDashboard();
    scopesService = result.scopesService;
    fetchSelectedScopesSpy = jest.spyOn(result.client, 'fetchMultipleScopes');
    dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');
    window.localStorage.clear();
  });

  afterEach(async () => {
    locationService.replace('');
    await resetScenes([fetchSelectedScopesSpy, dashboardReloadSpy]);
  });

  it('Fetches scope details on save', async () => {
    await openSelector();
    await selectResultCloud();
    await applyScopes();
    expect(fetchSelectedScopesSpy).toHaveBeenCalled();
    expect(getListOfScopes(scopesService)).toEqual(mocksScopes.filter(({ metadata: { name } }) => name === 'cloud'));
  });

  it('Does not save the scopes on close', async () => {
    await openSelector();
    await selectResultCloud();
    await cancelScopes();
    expect(fetchSelectedScopesSpy).not.toHaveBeenCalled();
    expect(getListOfScopes(scopesService)).toEqual([]);
  });

  it('Shows selected scopes', async () => {
    await updateScopes(scopesService, ['grafana']);
    expectScopesSelectorValue('Grafana');
  });

  it('Does not reload the dashboard on scope change', async () => {
    await updateScopes(scopesService, ['grafana']);
    expect(dashboardReloadSpy).not.toHaveBeenCalled();
  });

  it('Should initializae values from the URL', async () => {
    const mockLocation = {
      pathname: '/dashboard',
      search: '?scopes=grafana&scope_node=applications-grafana',
      hash: '',
      key: 'test',
      state: null,
    };

    jest.spyOn(locationService, 'getLocation').mockReturnValue(mockLocation);
    jest.spyOn(locationService, 'getSearch').mockReturnValue(new URLSearchParams(mockLocation.search));

    await resetScenes([fetchSelectedScopesSpy, dashboardReloadSpy]);
    await renderDashboard();
    // Lowercase because we don't have any backend that returns the correct case, then it falls back to the value in the URL
    expectScopesSelectorValue('grafana');
    await openSelector();
    //screen.debug(undefined, 100000);
    expectResultApplicationsGrafanaSelected();

    jest.spyOn(locationService, 'getLocation').mockRestore();
    jest.spyOn(locationService, 'getSearch').mockRestore();
  });

  describe('Recent scopes', () => {
    it('Recent scopes should appear after selecting a second set of scopes', async () => {
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await applyScopes();

      await openSelector();
      await selectResultApplicationsMimir();
      await applyScopes();

      // recent scopes only show on top level, so we need to make sure the scopes tree is not expanded.
      await hoverSelector();
      await clearSelector();

      await openSelector();
      expectRecentScopesSection();
      await expandRecentScopes();
      expectRecentScope('Grafana Applications');
      expectRecentScope('Grafana, Mimir Applications');
      await selectRecentScope('Grafana Applications');

      expectScopesSelectorValue('Grafana');

      await openSelector();
      // Close to root node so we can see the recent scopes
      await expandResultApplications();

      await expandRecentScopes();
      expectRecentScope('Grafana, Mimir Applications');
      expectRecentScopeNotPresent('Grafana Applications');
      expectRecentScopeNotPresent('Mimir Applications');
      await selectRecentScope('Grafana, Mimir Applications');

      expectScopesSelectorValue('Grafana + Mimir');
    });

    it('recent scopes should not be visible when the first scope is selected', async () => {
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await applyScopes();

      await openSelector();
      // Close to root node so we can try to see the recent scopes
      await expandResultApplications();
      expectRecentScopeNotPresentInDocument();
    });

    it('should not show recent scopes when no scopes have been previously selected', async () => {
      await openSelector();
      expectRecentScopeNotPresentInDocument();
    });

    it('should maintain recent scopes after deselecting all scopes', async () => {
      // First select some scopes
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await selectResultApplicationsMimir();
      await applyScopes();

      // Deselect all scopes
      await clearSelector();

      // Recent scopes should still be available
      await openSelector();
      expectRecentScopesSection();
      await expandRecentScopes();
      expectRecentScope('Grafana, Mimir Applications');
    });

    it('should update recent scopes when selecting a different combination', async () => {
      // First select Grafana + Mimir
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await selectResultApplicationsMimir();
      await applyScopes();

      // Then select just Grafana
      await openSelector();
      await selectResultApplicationsMimir();
      await applyScopes();

      await clearSelector();

      // Check recent scopes are updated
      await openSelector();
      await expandRecentScopes();
      expectRecentScope('Grafana, Mimir Applications');
      expectRecentScope('Grafana Applications');
    });
  });
});
