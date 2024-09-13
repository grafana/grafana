import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { getClosestScopesFacade } from '../utils';

import { applyScopes, cancelScopes, openSelector, selectResultCloud, updateScopes } from './utils/actions';
import { expectNotDashboardReload, expectScopesSelectorValue } from './utils/assertions';
import { fetchSelectedScopesSpy, getDatasource, getInstanceSettings, getMock, mocksScopes } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Selector', () => {
  let dashboardScene: DashboardScene;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(() => {
    dashboardScene = renderDashboard();
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Fetches scope details on save', async () => {
    await openSelector();
    await selectResultCloud();
    await applyScopes();
    expect(fetchSelectedScopesSpy).toHaveBeenCalled();
    expect(getClosestScopesFacade(dashboardScene)?.value).toEqual(
      mocksScopes.filter(({ metadata: { name } }) => name === 'cloud')
    );
  });

  it('Does not save the scopes on close', async () => {
    await openSelector();
    await selectResultCloud();
    await cancelScopes();
    expect(fetchSelectedScopesSpy).not.toHaveBeenCalled();
    expect(getClosestScopesFacade(dashboardScene)?.value).toEqual([]);
  });

  it('Shows selected scopes', async () => {
    await updateScopes(['grafana']);
    expectScopesSelectorValue('Grafana');
  });

  it('Does not reload the dashboard on scope change', async () => {
    await updateScopes(['grafana']);
    expectNotDashboardReload();
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
