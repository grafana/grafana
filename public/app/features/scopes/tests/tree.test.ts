import { config } from '@grafana/runtime';

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
  expectPersistedApplicationsGrafanaNotPresent,
  expectPersistedApplicationsMimirNotPresent,
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
  expectSelectedScopePath,
  expectTreeScopePath,
} from './utils/assertions';
import { fetchNodesSpy, fetchScopeSpy, getDatasource, getInstanceSettings, getMock } from './utils/mocks';
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
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(() => {
    renderDashboard();
  });

  afterEach(async () => {
    await resetScenes();
  });

  it('Fetches scope details on select', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    expect(fetchScopeSpy).toHaveBeenCalledTimes(1);
  });

  it('Selects the proper scopes', async () => {
    await updateScopes(['grafana', 'mimir']);
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
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectResultApplicationsGrafanaNotPresent();
    expectResultApplicationsMimirNotPresent();
    expectResultApplicationsCloudPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await searchScopes('Grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
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
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectPersistedApplicationsMimirPresent();
    expectPersistedApplicationsGrafanaNotPresent();
    expectResultApplicationsMimirNotPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Does not persist a retrieved scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectPersistedApplicationsMimirNotPresent();
    expectResultApplicationsMimirPresent();
  });

  it('Removes persisted nodes', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectPersistedApplicationsMimirNotPresent();
    expectPersistedApplicationsGrafanaNotPresent();
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Persists nodes from search', async () => {
    await openSelector();
    await expandResultApplications();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);

    await selectResultApplicationsMimir();
    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectPersistedApplicationsMimirPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Selects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);

    await selectResultApplicationsGrafana();
    await applyScopes();
    expectScopesSelectorValue('Mimir, Grafana');
  });

  it('Deselects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);

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
    expectScopesHeadline('Recommended');

    await searchScopes('Applications');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(1);
    expectScopesHeadline('Results');

    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectScopesHeadline('No results found for your query');
  });

  it('Updates the paths for scopes without paths on nodes fetching', async () => {
    const selectedScopeName = 'grafana';
    const unselectedScopeName = 'mimir';
    const selectedScopeNameFromOtherGroup = 'dev';

    await updateScopes([selectedScopeName, selectedScopeNameFromOtherGroup]);
    expectSelectedScopePath(selectedScopeName, []);
    expectTreeScopePath(selectedScopeName, []);
    expectSelectedScopePath(unselectedScopeName, undefined);
    expectTreeScopePath(unselectedScopeName, undefined);
    expectSelectedScopePath(selectedScopeNameFromOtherGroup, []);
    expectTreeScopePath(selectedScopeNameFromOtherGroup, []);

    await openSelector();
    await expandResultApplications();
    const expectedPath = ['', 'applications', 'applications-grafana'];
    expectSelectedScopePath(selectedScopeName, expectedPath);
    expectTreeScopePath(selectedScopeName, expectedPath);
    expectSelectedScopePath(unselectedScopeName, undefined);
    expectTreeScopePath(unselectedScopeName, undefined);
    expectSelectedScopePath(selectedScopeNameFromOtherGroup, []);
    expectTreeScopePath(selectedScopeNameFromOtherGroup, []);
  });
});
