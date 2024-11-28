import { config, getScopesDashboardsService } from '@grafana/runtime';

import {
  clearNotFound,
  expandDashboardFolder,
  searchDashboards,
  toggleDashboards,
  updateScopes,
} from './utils/actions';
import {
  expectDashboardFolderNotInDocument,
  expectDashboardInDocument,
  expectDashboardLength,
  expectDashboardNotInDocument,
  expectDashboardsClosed,
  expectDashboardSearchValue,
  expectDashboardsOpen,
  expectDashboardsSearch,
  expectNoDashboardsForFilter,
  expectNoDashboardsForScope,
  expectNoDashboardsNoScopes,
  expectNoDashboardsSearch,
} from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

import SpyInstance = jest.SpyInstance;

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Dashboards list', () => {
  let fetchDashboardsApiSpy: SpyInstance;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(() => {
    renderDashboard();
    fetchDashboardsApiSpy = jest.spyOn(getScopesDashboardsService(), 'fetchDashboardsApi');
  });

  afterEach(async () => {
    await resetScenes();
    fetchDashboardsApiSpy.mockClear();
    getMock.mockClear();
  });

  it('Opens container and fetches dashboards list when a scope is selected', async () => {
    expectDashboardsClosed();
    await updateScopes(['mimir']);
    expectDashboardsOpen();
    expect(fetchDashboardsApiSpy).toHaveBeenCalled();
  });

  it('Closes container when no scopes are selected', async () => {
    await updateScopes(['mimir']);
    expectDashboardsOpen();
    await updateScopes(['mimir', 'loki']);
    expectDashboardsOpen();
    await updateScopes([]);
    expectDashboardsClosed();
  });

  it('Fetches dashboards list when the list is expanded', async () => {
    await toggleDashboards();
    await updateScopes(['mimir']);
    expect(fetchDashboardsApiSpy).toHaveBeenCalled();
  });

  it('Fetches dashboards list when the list is expanded after scope selection', async () => {
    await updateScopes(['mimir']);
    await toggleDashboards();
    expect(fetchDashboardsApiSpy).toHaveBeenCalled();
  });

  it('Shows dashboards for multiple scopes', async () => {
    await toggleDashboards();
    await updateScopes(['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardFolderNotInDocument('Components');
    expectDashboardFolderNotInDocument('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardNotInDocument('multiple3-datasource-errors');
    expectDashboardNotInDocument('multiple4-datasource-logs');
    expectDashboardNotInDocument('multiple0-ingester');
    expectDashboardNotInDocument('multiple1-distributor');
    expectDashboardNotInDocument('multiple2-compacter');
    expectDashboardNotInDocument('another-stats');

    await updateScopes(['grafana', 'mimir']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    await expandDashboardFolder('Components');
    await expandDashboardFolder('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardLength('multiple3-datasource-errors', 2);
    expectDashboardLength('multiple4-datasource-logs', 2);
    expectDashboardLength('multiple0-ingester', 2);
    expectDashboardLength('multiple1-distributor', 2);
    expectDashboardLength('multiple2-compacter', 2);
    expectDashboardInDocument('another-stats');

    await updateScopes(['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardFolderNotInDocument('Components');
    expectDashboardFolderNotInDocument('Investigations');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');
    expectDashboardFolderNotInDocument('multiple3-datasource-errors');
    expectDashboardFolderNotInDocument('multiple4-datasource-logs');
    expectDashboardFolderNotInDocument('multiple0-ingester');
    expectDashboardFolderNotInDocument('multiple1-distributor');
    expectDashboardFolderNotInDocument('multiple2-compacter');
    expectDashboardFolderNotInDocument('another-stats');
  });

  it('Filters the dashboards list for dashboards', async () => {
    await toggleDashboards();
    await updateScopes(['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');

    await searchDashboards('Stats');
    expectDashboardFolderNotInDocument('general-data-sources');
    expectDashboardFolderNotInDocument('general-usage');
    expectDashboardFolderNotInDocument('observability-backend-errors');
    expectDashboardFolderNotInDocument('observability-backend-logs');
    expectDashboardFolderNotInDocument('observability-frontend-errors');
    expectDashboardFolderNotInDocument('observability-frontend-logs');
    expectDashboardFolderNotInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardFolderNotInDocument('usage-usage-overview');
    expectDashboardFolderNotInDocument('frontend');
    expectDashboardFolderNotInDocument('overview');
    expectDashboardInDocument('stats');
  });

  it('Filters the dashboards list for folders', async () => {
    await toggleDashboards();
    await updateScopes(['grafana']);
    await expandDashboardFolder('General');
    await expandDashboardFolder('Observability');
    await expandDashboardFolder('Usage');
    expectDashboardInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardInDocument('observability-backend-errors');
    expectDashboardInDocument('observability-backend-logs');
    expectDashboardInDocument('observability-frontend-errors');
    expectDashboardInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardInDocument('frontend');
    expectDashboardInDocument('overview');
    expectDashboardInDocument('stats');

    await searchDashboards('Usage');
    expectDashboardFolderNotInDocument('general-data-sources');
    expectDashboardInDocument('general-usage');
    expectDashboardFolderNotInDocument('observability-backend-errors');
    expectDashboardFolderNotInDocument('observability-backend-logs');
    expectDashboardFolderNotInDocument('observability-frontend-errors');
    expectDashboardFolderNotInDocument('observability-frontend-logs');
    expectDashboardInDocument('usage-data-sources');
    expectDashboardInDocument('usage-stats');
    expectDashboardInDocument('usage-usage-overview');
    expectDashboardFolderNotInDocument('frontend');
    expectDashboardFolderNotInDocument('overview');
    expectDashboardFolderNotInDocument('stats');
  });

  it('Deduplicates the dashboards list', async () => {
    await toggleDashboards();
    await updateScopes(['dev', 'ops']);
    await expandDashboardFolder('Cardinality Management');
    await expandDashboardFolder('Usage Insights');
    expectDashboardLength('cardinality-management-labels', 1);
    expectDashboardLength('cardinality-management-metrics', 1);
    expectDashboardLength('cardinality-management-overview', 1);
    expectDashboardLength('usage-insights-alertmanager', 1);
    expectDashboardLength('usage-insights-data-sources', 1);
    expectDashboardLength('usage-insights-metrics-ingestion', 1);
    expectDashboardLength('usage-insights-overview', 1);
    expectDashboardLength('usage-insights-query-errors', 1);
    expectDashboardLength('billing-usage', 1);
  });

  it('Shows a proper message when no scopes are selected', async () => {
    await toggleDashboards();
    expectNoDashboardsNoScopes();
    expectNoDashboardsSearch();
  });

  it('Does not show the input when there are no dashboards found for scope', async () => {
    await toggleDashboards();
    await updateScopes(['cloud']);
    expectNoDashboardsForScope();
    expectNoDashboardsSearch();
  });

  it('Shows the input and a message when there are no dashboards found for filter', async () => {
    await toggleDashboards();
    await updateScopes(['mimir']);
    await searchDashboards('unknown');
    expectDashboardsSearch();
    expectNoDashboardsForFilter();

    await clearNotFound();
    expectDashboardSearchValue('');
  });
});
