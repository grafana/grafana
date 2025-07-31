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
} from './utils/actions';
import {
  expectRecentScope,
  expectRecentScopeNotPresent,
  expectRecentScopeNotPresentInDocument,
  expectRecentScopesSection,
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

describe('Selector', () => {
  let fetchSelectedScopesSpy: jest.SpyInstance;
  let dashboardReloadSpy: jest.SpyInstance;
  let scopesService: ScopesService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
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

  describe('Recent scopes', () => {
    it('Recent scopes should appear after selecting a second set of scopes', async () => {
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await applyScopes();

      await openSelector();
      await selectResultApplicationsMimir();
      await applyScopes();

      // recent scopes only show on top level, so we need to make sure the scopes tree is not exapnded.
      await clearSelector();

      await openSelector();
      expectRecentScopesSection();
      await expandRecentScopes();
      expectRecentScope('Grafana');
      expectRecentScope('Grafana, Mimir');
      await selectRecentScope('Grafana');

      expectScopesSelectorValue('Grafana');

      await openSelector();
      await expandRecentScopes();
      expectRecentScope('Grafana, Mimir');
      expectRecentScopeNotPresent('Grafana');
      expectRecentScopeNotPresent('Mimir');
      await selectRecentScope('Grafana, Mimir');

      expectScopesSelectorValue('Grafana + Mimir');
    });

    it('recent scopes should not be visible when the first scope is selected', async () => {
      await openSelector();
      await expandResultApplications();
      await selectResultApplicationsGrafana();
      await applyScopes();

      await openSelector();
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
      expectRecentScope('Grafana, Mimir');
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
      expectRecentScope('Grafana, Mimir');
      expectRecentScope('Grafana');
    });
  });
});
