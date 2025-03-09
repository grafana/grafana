import { config } from '@grafana/runtime';

import { getDashboardScenePageStateManager } from '../../dashboard-scene/pages/DashboardScenePageStateManager';
import { ScopesSelectorService } from '../selector/ScopesSelectorService';

import { applyScopes, cancelScopes, openSelector, selectResultCloud, updateScopes } from './utils/actions';
import { expectScopesSelectorValue } from './utils/assertions';
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

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    await renderDashboard();
    fetchSelectedScopesSpy = jest.spyOn(ScopesSelectorService.instance!, 'fetchScopesApi');
    dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');
  });

  afterEach(async () => {
    await resetScenes([fetchSelectedScopesSpy, dashboardReloadSpy]);
  });

  it('Fetches scope details on save', async () => {
    await openSelector();
    await selectResultCloud();
    await applyScopes();
    expect(fetchSelectedScopesSpy).toHaveBeenCalled();
    expect(getListOfScopes()).toEqual(mocksScopes.filter(({ metadata: { name } }) => name === 'cloud'));
  });

  it('Does not save the scopes on close', async () => {
    await openSelector();
    await selectResultCloud();
    await cancelScopes();
    expect(fetchSelectedScopesSpy).not.toHaveBeenCalled();
    expect(getListOfScopes()).toEqual([]);
  });

  it('Shows selected scopes', async () => {
    await updateScopes(['grafana']);
    expectScopesSelectorValue('Grafana');
  });

  it('Does not reload the dashboard on scope change', async () => {
    await updateScopes(['grafana']);
    expect(dashboardReloadSpy).not.toHaveBeenCalled();
  });
});
