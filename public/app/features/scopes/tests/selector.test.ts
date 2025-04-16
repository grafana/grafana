import { setUncaughtExceptionCaptureCallback } from 'node:process';

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
} from './utils/actions';
import { expectRecentScope, expectRecentScopesSection, expectScopesSelectorValue } from './utils/assertions';
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

      // Grafana,Mimir currently selected. Grafana is the first recent scope.
      await openSelector();
      expectRecentScopesSection();
      await expandRecentScopes();
      expectRecentScope('Grafana');
      await selectRecentScope('Grafana');

      expectScopesSelectorValue('Grafana');

      await openSelector();
      await expandRecentScopes();
      expectRecentScope('Grafana, Mimir');
      await selectRecentScope('Grafana, Mimir');

      expectScopesSelectorValue('Grafana, Mimir');
    });
  });
});
