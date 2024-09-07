import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { getClosestScopesFacade } from '../utils';

import {
  applyScopes,
  cancelScopes,
  expandResultApplications,
  openSelector,
  selectResultApplicationsGrafana,
  selectResultApplicationsMimir,
  selectResultCloud,
} from './utils/actions';
import { expectNotDashboardReload, expectScopesSelectorValue } from './utils/assertions';
import { fetchSelectedScopesSpy, getDatasource, getInstanceSettings, getMock, mocksScopes } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/scenes', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/scenes'),
  sceneUtils: {
    ...jest.requireActual('@grafana/scenes').sceneUtils,
    registerVariableMacro: () => () => undefined,
  },
}));

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
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
    await openSelector();
    await selectResultCloud();
    await applyScopes();
    expectScopesSelectorValue('Cloud');
  });

  it('Does not reload the dashboard on scope change', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await applyScopes();
    expectNotDashboardReload();
  });

  it('Adds scopes to enrichers', async () => {
    const queryRunner = sceneGraph.getQueryController(dashboardScene)!;

    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await applyScopes();
    let scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'grafana');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);

    await openSelector();
    await selectResultApplicationsMimir();
    await applyScopes();
    scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);

    await openSelector();
    await selectResultApplicationsGrafana();
    await applyScopes();
    scopes = mocksScopes.filter(({ metadata: { name } }) => name === 'mimir');
    expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
    expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(scopes);
  });
});
