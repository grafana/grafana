import { config, locationService } from '@grafana/runtime';

import { ScopesService } from '../ScopesService';

import {
  applyScopes,
  clearScopesSearch,
  expandResultApplications,
  expandResultApplicationsCloud,
  expandResultCloud,
  openSelector,
  searchScopes,
  selectPersistedApplicationsMimir,
  selectResultApplicationsCloud,
  selectResultApplicationsCloudDev,
  selectResultApplicationsGrafana,
  selectResultApplicationsMimir,
  selectResultCloud,
  selectResultCloudDev,
  selectResultCloudOps,
  updateScopes,
} from './utils/actions';
import {
  expectPersistedApplicationsMimirPresent,
  expectResultApplicationsCloudNotPresent,
  expectResultApplicationsCloudPresent,
  expectResultApplicationsGrafanaNotPresent,
  expectResultApplicationsGrafanaPresent,
  expectResultApplicationsGrafanaSelected,
  expectResultApplicationsMimirNotPresent,
  expectResultApplicationsMimirPresent,
  expectResultApplicationsMimirSelected,
  expectResultCloudDevNotSelected,
  expectResultCloudDevSelected,
  expectResultCloudOpsNotSelected,
  expectResultCloudOpsSelected,
  expectScopesHeadline,
  expectScopesSelectorValue,
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

describe('Tree', () => {
  let fetchNodesSpy: jest.SpyInstance;
  let fetchScopeSpy: jest.SpyInstance;
  let scopesService: ScopesService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const result = await renderDashboard();
    scopesService = result.scopesService;
    fetchNodesSpy = jest.spyOn(result.client, 'fetchNodes');
    fetchScopeSpy = jest.spyOn(result.client, 'fetchScope');
  });

  afterEach(async () => {
    locationService.replace('');
    await resetScenes([fetchNodesSpy, fetchScopeSpy]);
  });

  it('Fetches scope details on select', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    expect(fetchScopeSpy).toHaveBeenCalledTimes(1);
  });

  it('Selects the proper scopes', async () => {
    await updateScopes(scopesService, ['grafana', 'mimir']);
    await openSelector();
    await expandResultApplications();
    expectResultApplicationsGrafanaSelected();
    expectResultApplicationsMimirSelected();
  });

  it('Can select scopes from same level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await selectResultApplicationsMimir();
    await selectResultApplicationsCloud();
    await applyScopes();
    expectScopesSelectorValue('Grafana, Mimir, Cloud');
  });

  it('Can select a node from an inner level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await expandResultApplicationsCloud();
    await selectResultApplicationsCloudDev();
    await applyScopes();
    expectScopesSelectorValue('Dev');
  });

  it('Can select a node from an upper level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await expandResultApplications();
    await selectResultCloud();
    await applyScopes();
    expectScopesSelectorValue('Cloud');
  });

  it('Respects only one select per container', async () => {
    await openSelector();
    await expandResultCloud();
    await selectResultCloudDev();
    expectResultCloudDevSelected();
    expectResultCloudOpsNotSelected();

    await selectResultCloudOps();
    expectResultCloudDevNotSelected();
    expectResultCloudOpsSelected();
  });

  it('Search works', async () => {
    await openSelector();
    await expandResultApplications();
    await searchScopes('Cloud');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectResultApplicationsGrafanaNotPresent();
    expectResultApplicationsMimirNotPresent();
    expectResultApplicationsCloudPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);

    await searchScopes('Grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
    expectResultApplicationsGrafanaPresent();
    expectResultApplicationsCloudNotPresent();
  });

  it('Opens to a selected scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await expandResultApplications();
    await expandResultCloud();
    await applyScopes();
    await openSelector();
    expectResultApplicationsMimirPresent();
  });

  it('Persists a scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectPersistedApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Does not persist a retrieved scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectResultApplicationsMimirPresent();
  });

  it('Removes persisted nodes', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Persists nodes from search', async () => {
    await openSelector();
    await expandResultApplications();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsMimir();
    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
    expectPersistedApplicationsMimirPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Selects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsGrafana();
    await applyScopes();
    expectScopesSelectorValue('Mimir, Grafana');
  });

  it('Deselects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsGrafana();
    await applyScopes();
    expectScopesSelectorValue('Mimir, Grafana');

    await openSelector();
    await selectPersistedApplicationsMimir();
    await applyScopes();
    expectScopesSelectorValue('Grafana');
  });

  it('Shows the proper headline', async () => {
    await openSelector();

    await searchScopes('Applications');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectScopesHeadline('Results');

    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectScopesHeadline('No results found for your query');
  });

  it('Should only show Recommended when there are no leaf container nodes visible', async () => {
    await openSelector();
    await expandResultApplications();
    await expandResultApplicationsCloud();
    expectScopesHeadline('Recommended');
  });
});
