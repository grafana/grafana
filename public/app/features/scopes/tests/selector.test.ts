import { config, getScopesSelectorService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { getDashboardScenePageStateManager } from '../../dashboard-scene/pages/DashboardScenePageStateManager';
import { getClosestScopesFacade } from '../utils';

import { applyScopes, cancelScopes, openSelector, selectResultCloud, updateScopes } from './utils/actions';
import { expectScopesSelectorValue } from './utils/assertions';
import { getDatasource, getInstanceSettings, mocksScopes } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

import SpyInstance = jest.SpyInstance;

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Selector', () => {
  let dashboardScene: DashboardScene;
  let fetchSelectedScopesApiSpy: SpyInstance;
  let dashboardReloadSpy: SpyInstance;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(() => {
    dashboardScene = renderDashboard();
    fetchSelectedScopesApiSpy = jest.spyOn(getScopesSelectorService(), 'fetchSelectedScopesApi');
    dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Fetches scope details on save', async () => {
    await openSelector();
    await selectResultCloud();
    await applyScopes();
    expect(fetchSelectedScopesApiSpy).toHaveBeenCalled();
    expect(getClosestScopesFacade(dashboardScene)?.value).toEqual(
      mocksScopes.filter(({ metadata: { name } }) => name === 'cloud')
    );
  });

  it('Does not save the scopes on close', async () => {
    await openSelector();
    await selectResultCloud();
    await cancelScopes();
    expect(fetchSelectedScopesApiSpy).not.toHaveBeenCalled();
    expect(getClosestScopesFacade(dashboardScene)?.value).toEqual([]);
  });

  it('Shows selected scopes', async () => {
    await updateScopes(['grafana']);
    expectScopesSelectorValue('Grafana');
  });

  it('Does not reload the dashboard on scope change', async () => {
    await updateScopes(['grafana']);
    expect(dashboardReloadSpy).not.toHaveBeenCalled();
  });

  it('Adds scopes to enrichers', async () => {
    const queryRunner = sceneGraph.getQueryController(dashboardScene)!;

    await updateScopes(['grafana']);
    let scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'grafana');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);

    await updateScopes(['grafana', 'mimir']);
    scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);

    await updateScopes(['mimir']);
    scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'mimir');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);
  });
});
