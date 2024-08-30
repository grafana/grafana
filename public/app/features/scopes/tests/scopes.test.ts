import { act, cleanup, waitFor } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { initializeScopes, scopesDashboardsScene, scopesSelectorScene } from '../instance';
import { getClosestScopesFacade } from '../utils';

import {
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getMock,
  mocksScopes,
} from './utils/mocks';
import { buildTestScene, renderDashboard, resetScenes } from './utils/render';
import {
  getDashboard,
  getDashboardFolderExpand,
  getDashboardsExpand,
  getDashboardsSearch,
  getNotFoundForFilter,
  getNotFoundForFilterClear,
  getNotFoundForScope,
  getNotFoundNoScopes,
  getPersistedApplicationsMimirSelect,
  getPersistedApplicationsMimirTitle,
  getResultApplicationsCloudDevSelect,
  getResultApplicationsCloudExpand,
  getResultApplicationsCloudOpsSelect,
  getResultApplicationsCloudSelect,
  getResultApplicationsExpand,
  getResultApplicationsGrafanaSelect,
  getResultApplicationsGrafanaTitle,
  getResultApplicationsMimirSelect,
  getResultApplicationsMimirTitle,
  getResultCloudDevRadio,
  getResultCloudExpand,
  getResultCloudOpsRadio,
  getResultCloudSelect,
  getSelectorApply,
  getSelectorCancel,
  getSelectorInput,
  getTreeHeadline,
  getTreeSearch,
  queryAllDashboard,
  queryDashboard,
  queryDashboardFolderExpand,
  queryDashboardsContainer,
  queryDashboardsSearch,
  queryPersistedApplicationsGrafanaTitle,
  queryPersistedApplicationsMimirTitle,
  queryResultApplicationsCloudTitle,
  queryResultApplicationsGrafanaTitle,
  queryResultApplicationsMimirTitle,
  querySelectorApply,
} from './utils/selectors';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({
    get: getMock,
  }),
  usePluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

const panelPlugin = getPanelPlugin({
  id: 'table',
  skipDataQuery: true,
});

config.panels['table'] = panelPlugin.meta;

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(panelPlugin),
  getPanelPluginFromCache: () => undefined,
});

describe('Scopes', () => {
  describe('Feature flag off', () => {
    beforeAll(() => {
      config.featureToggles.scopeFilters = false;
      config.featureToggles.groupByVariable = true;

      initializeScopes();
    });

    it('Does not initialize', () => {
      const dashboardScene = buildTestScene();
      dashboardScene.activate();
      expect(scopesSelectorScene).toBeNull();
    });
  });

  describe('Feature flag on', () => {
    let dashboardScene: DashboardScene;

    beforeAll(() => {
      config.featureToggles.scopeFilters = true;
      config.featureToggles.groupByVariable = true;
    });

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(jest.fn());

      fetchNodesSpy.mockClear();
      fetchScopeSpy.mockClear();
      fetchSelectedScopesSpy.mockClear();
      fetchDashboardsSpy.mockClear();
      getMock.mockClear();

      initializeScopes();

      dashboardScene = buildTestScene();

      renderDashboard(dashboardScene);
    });

    afterEach(() => {
      resetScenes();
      cleanup();
    });

    describe('Tree', () => {
      it('Navigates through scopes nodes', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsCloudExpand());
        await userEvents.click(getResultApplicationsExpand());
      });

      it('Fetches scope details on select', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await waitFor(() => expect(fetchScopeSpy).toHaveBeenCalledTimes(1));
      });

      it('Selects the proper scopes', async () => {
        await act(async () =>
          scopesSelectorScene?.updateScopes([
            { scopeName: 'grafana', path: [] },
            { scopeName: 'mimir', path: [] },
          ])
        );
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        expect(getResultApplicationsGrafanaSelect()).toBeChecked();
        expect(getResultApplicationsMimirSelect()).toBeChecked();
      });

      it('Can select scopes from same level', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getResultApplicationsCloudSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Grafana, Mimir, Cloud');
      });

      it('Can select a node from an inner level', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getResultApplicationsCloudExpand());
        await userEvents.click(getResultApplicationsCloudDevSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Dev');
      });

      it('Can select a node from an upper level', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultCloudSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Cloud');
      });

      it('Respects only one select per container', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudExpand());
        await userEvents.click(getResultCloudDevRadio());
        expect(getResultCloudDevRadio().checked).toBe(true);
        expect(getResultCloudOpsRadio().checked).toBe(false);
        await userEvents.click(getResultCloudOpsRadio());
        expect(getResultCloudDevRadio().checked).toBe(false);
        expect(getResultCloudOpsRadio().checked).toBe(true);
      });

      it('Search works', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.type(getTreeSearch(), 'Cloud');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(queryResultApplicationsGrafanaTitle()).not.toBeInTheDocument();
        expect(queryResultApplicationsMimirTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsCloudSelect()).toBeInTheDocument();
        await userEvents.clear(getTreeSearch());
        await userEvents.type(getTreeSearch(), 'Grafana');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(getResultApplicationsGrafanaSelect()).toBeInTheDocument();
        expect(queryResultApplicationsCloudTitle()).not.toBeInTheDocument();
      });

      it('Opens to a selected scope', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultCloudExpand());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getSelectorInput());
        expect(queryResultApplicationsMimirTitle()).toBeInTheDocument();
      });

      it('Persists a scope', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'grafana');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(getPersistedApplicationsMimirTitle()).toBeInTheDocument();
        expect(queryPersistedApplicationsGrafanaTitle()).not.toBeInTheDocument();
        expect(queryResultApplicationsMimirTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
      });

      it('Does not persist a retrieved scope', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'mimir');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(queryPersistedApplicationsMimirTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
      });

      it('Removes persisted nodes', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'grafana');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.clear(getTreeSearch());
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(queryPersistedApplicationsMimirTitle()).not.toBeInTheDocument();
        expect(queryPersistedApplicationsGrafanaTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
        expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
      });

      it('Persists nodes from search', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.type(getTreeSearch(), 'mimir');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'unknown');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(getPersistedApplicationsMimirTitle()).toBeInTheDocument();
        await userEvents.clear(getTreeSearch());
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(5));
        expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
        expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
      });

      it('Selects a persisted scope', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'grafana');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Mimir, Grafana');
      });

      it('Deselects a persisted scope', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.type(getTreeSearch(), 'grafana');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Mimir, Grafana');
        await userEvents.click(getSelectorInput());
        await userEvents.click(getPersistedApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toBe('Grafana');
      });

      it('Shows the proper headline', async () => {
        await userEvents.click(getSelectorInput());
        expect(getTreeHeadline()).toHaveTextContent('Recommended');
        await userEvents.type(getTreeSearch(), 'Applications');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(2));
        expect(getTreeHeadline()).toHaveTextContent('Results');
        await userEvents.type(getTreeSearch(), 'unknown');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(getTreeHeadline()).toHaveTextContent('No results found for your query');
      });
    });

    describe('Selector', () => {
      it('Opens', async () => {
        await userEvents.click(getSelectorInput());
        expect(getSelectorApply()).toBeInTheDocument();
      });

      it('Fetches scope details on save', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => expect(fetchSelectedScopesSpy).toHaveBeenCalled());
        expect(getClosestScopesFacade(dashboardScene)?.value).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'cloud')
        );
      });

      it('Does not save the scopes on close', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudSelect());
        await userEvents.click(getSelectorCancel());
        await waitFor(() => expect(fetchSelectedScopesSpy).not.toHaveBeenCalled());
        expect(getClosestScopesFacade(dashboardScene)?.value).toEqual([]);
      });

      it('Shows selected scopes', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudSelect());
        await userEvents.click(getSelectorApply());
        expect(getSelectorInput().value).toEqual('Cloud');
      });
    });

    describe('Dashboards list', () => {
      it('Toggles expanded state', async () => {
        await userEvents.click(getDashboardsExpand());
        expect(getNotFoundNoScopes()).toBeInTheDocument();
      });

      it('Does not fetch dashboards list when the list is not expanded', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => expect(fetchDashboardsSpy).not.toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded after scope selection', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardsExpand());
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
      });

      it('Shows dashboards for multiple scopes', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('General'));
        await userEvents.click(getDashboardFolderExpand('Observability'));
        await userEvents.click(getDashboardFolderExpand('Usage'));
        expect(queryDashboardFolderExpand('Components')).not.toBeInTheDocument();
        expect(queryDashboardFolderExpand('Investigations')).not.toBeInTheDocument();
        expect(getDashboard('general-data-sources')).toBeInTheDocument();
        expect(getDashboard('general-usage')).toBeInTheDocument();
        expect(getDashboard('observability-backend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-backend-logs')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-logs')).toBeInTheDocument();
        expect(getDashboard('usage-data-sources')).toBeInTheDocument();
        expect(getDashboard('usage-stats')).toBeInTheDocument();
        expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
        expect(getDashboard('frontend')).toBeInTheDocument();
        expect(getDashboard('overview')).toBeInTheDocument();
        expect(getDashboard('stats')).toBeInTheDocument();
        expect(queryDashboard('multiple3-datasource-errors')).not.toBeInTheDocument();
        expect(queryDashboard('multiple4-datasource-logs')).not.toBeInTheDocument();
        expect(queryDashboard('multiple0-ingester')).not.toBeInTheDocument();
        expect(queryDashboard('multiple1-distributor')).not.toBeInTheDocument();
        expect(queryDashboard('multiple2-compacter')).not.toBeInTheDocument();
        expect(queryDashboard('another-stats')).not.toBeInTheDocument();
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('General'));
        await userEvents.click(getDashboardFolderExpand('Observability'));
        await userEvents.click(getDashboardFolderExpand('Usage'));
        await userEvents.click(getDashboardFolderExpand('Components'));
        await userEvents.click(getDashboardFolderExpand('Investigations'));
        expect(getDashboard('general-data-sources')).toBeInTheDocument();
        expect(getDashboard('general-usage')).toBeInTheDocument();
        expect(getDashboard('observability-backend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-backend-logs')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-logs')).toBeInTheDocument();
        expect(getDashboard('usage-data-sources')).toBeInTheDocument();
        expect(getDashboard('usage-stats')).toBeInTheDocument();
        expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
        expect(getDashboard('frontend')).toBeInTheDocument();
        expect(getDashboard('overview')).toBeInTheDocument();
        expect(getDashboard('stats')).toBeInTheDocument();
        expect(queryAllDashboard('multiple3-datasource-errors')).toHaveLength(2);
        expect(queryAllDashboard('multiple4-datasource-logs')).toHaveLength(2);
        expect(queryAllDashboard('multiple0-ingester')).toHaveLength(2);
        expect(queryAllDashboard('multiple1-distributor')).toHaveLength(2);
        expect(queryAllDashboard('multiple2-compacter')).toHaveLength(2);
        expect(getDashboard('another-stats')).toBeInTheDocument();
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('General'));
        await userEvents.click(getDashboardFolderExpand('Observability'));
        await userEvents.click(getDashboardFolderExpand('Usage'));
        expect(queryDashboardFolderExpand('Components')).not.toBeInTheDocument();
        expect(queryDashboardFolderExpand('Investigations')).not.toBeInTheDocument();
        expect(getDashboard('general-data-sources')).toBeInTheDocument();
        expect(getDashboard('general-usage')).toBeInTheDocument();
        expect(getDashboard('observability-backend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-backend-logs')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-logs')).toBeInTheDocument();
        expect(getDashboard('usage-data-sources')).toBeInTheDocument();
        expect(getDashboard('usage-stats')).toBeInTheDocument();
        expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
        expect(getDashboard('frontend')).toBeInTheDocument();
        expect(getDashboard('overview')).toBeInTheDocument();
        expect(getDashboard('stats')).toBeInTheDocument();
        expect(queryDashboard('multiple3-datasource-errors')).not.toBeInTheDocument();
        expect(queryDashboard('multiple4-datasource-logs')).not.toBeInTheDocument();
        expect(queryDashboard('multiple0-ingester')).not.toBeInTheDocument();
        expect(queryDashboard('multiple1-distributor')).not.toBeInTheDocument();
        expect(queryDashboard('multiple2-compacter')).not.toBeInTheDocument();
        expect(queryDashboard('another-stats')).not.toBeInTheDocument();
      });

      it('Filters the dashboards list for dashboards', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('General'));
        await userEvents.click(getDashboardFolderExpand('Observability'));
        await userEvents.click(getDashboardFolderExpand('Usage'));
        expect(getDashboard('general-data-sources')).toBeInTheDocument();
        expect(getDashboard('general-usage')).toBeInTheDocument();
        expect(getDashboard('observability-backend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-backend-logs')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-logs')).toBeInTheDocument();
        expect(getDashboard('usage-data-sources')).toBeInTheDocument();
        expect(getDashboard('usage-stats')).toBeInTheDocument();
        expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
        expect(getDashboard('frontend')).toBeInTheDocument();
        expect(getDashboard('overview')).toBeInTheDocument();
        expect(getDashboard('stats')).toBeInTheDocument();
        await userEvents.type(getDashboardsSearch(), 'Stats');
        await waitFor(() => {
          expect(queryDashboard('general-data-sources')).not.toBeInTheDocument();
          expect(queryDashboard('general-usage')).not.toBeInTheDocument();
          expect(queryDashboard('observability-backend-errors')).not.toBeInTheDocument();
          expect(queryDashboard('observability-backend-logs')).not.toBeInTheDocument();
          expect(queryDashboard('observability-frontend-errors')).not.toBeInTheDocument();
          expect(queryDashboard('observability-frontend-logs')).not.toBeInTheDocument();
          expect(queryDashboard('usage-data-sources')).not.toBeInTheDocument();
          expect(getDashboard('usage-stats')).toBeInTheDocument();
          expect(queryDashboard('usage-usage-overview')).not.toBeInTheDocument();
          expect(queryDashboard('frontend')).not.toBeInTheDocument();
          expect(queryDashboard('overview')).not.toBeInTheDocument();
          expect(getDashboard('stats')).toBeInTheDocument();
        });
      });

      it('Filters the dashboards list for folders', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('General'));
        await userEvents.click(getDashboardFolderExpand('Observability'));
        await userEvents.click(getDashboardFolderExpand('Usage'));
        expect(getDashboard('general-data-sources')).toBeInTheDocument();
        expect(getDashboard('general-usage')).toBeInTheDocument();
        expect(getDashboard('observability-backend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-backend-logs')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-errors')).toBeInTheDocument();
        expect(getDashboard('observability-frontend-logs')).toBeInTheDocument();
        expect(getDashboard('usage-data-sources')).toBeInTheDocument();
        expect(getDashboard('usage-stats')).toBeInTheDocument();
        expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
        expect(getDashboard('frontend')).toBeInTheDocument();
        expect(getDashboard('overview')).toBeInTheDocument();
        expect(getDashboard('stats')).toBeInTheDocument();
        await userEvents.type(getDashboardsSearch(), 'Usage');
        await waitFor(() => {
          expect(queryDashboard('general-data-sources')).not.toBeInTheDocument();
          expect(getDashboard('general-usage')).toBeInTheDocument();
          expect(queryDashboard('observability-backend-errors')).not.toBeInTheDocument();
          expect(queryDashboard('observability-backend-logs')).not.toBeInTheDocument();
          expect(queryDashboard('observability-frontend-errors')).not.toBeInTheDocument();
          expect(queryDashboard('observability-frontend-logs')).not.toBeInTheDocument();
          expect(getDashboard('usage-data-sources')).toBeInTheDocument();
          expect(getDashboard('usage-stats')).toBeInTheDocument();
          expect(getDashboard('usage-usage-overview')).toBeInTheDocument();
          expect(queryDashboard('frontend')).not.toBeInTheDocument();
          expect(queryDashboard('overview')).not.toBeInTheDocument();
          expect(queryDashboard('stats')).not.toBeInTheDocument();
        });
      });

      it('Deduplicates the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsCloudExpand());
        await userEvents.click(getResultApplicationsCloudDevSelect());
        await userEvents.click(getResultApplicationsCloudOpsSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.click(getDashboardFolderExpand('Cardinality Management'));
        await userEvents.click(getDashboardFolderExpand('Usage Insights'));
        expect(queryAllDashboard('cardinality-management-labels')).toHaveLength(1);
        expect(queryAllDashboard('cardinality-management-metrics')).toHaveLength(1);
        expect(queryAllDashboard('cardinality-management-overview')).toHaveLength(1);
        expect(queryAllDashboard('usage-insights-alertmanager')).toHaveLength(1);
        expect(queryAllDashboard('usage-insights-data-sources')).toHaveLength(1);
        expect(queryAllDashboard('usage-insights-metrics-ingestion')).toHaveLength(1);
        expect(queryAllDashboard('usage-insights-overview')).toHaveLength(1);
        expect(queryAllDashboard('usage-insights-query-errors')).toHaveLength(1);
        expect(queryAllDashboard('billing-usage')).toHaveLength(1);
      });

      it('Shows a proper message when no scopes are selected', async () => {
        await userEvents.click(getDashboardsExpand());
        expect(getNotFoundNoScopes()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Does not show the input when there are no dashboards found for scope', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudSelect());
        await userEvents.click(getSelectorApply());
        expect(getNotFoundForScope()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Shows the input and a message when there are no dashboards found for filter', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await userEvents.type(getDashboardsSearch(), 'unknown');
        await waitFor(() => {
          expect(queryDashboardsSearch()).toBeInTheDocument();
          expect(getNotFoundForFilter()).toBeInTheDocument();
        });
        await userEvents.click(getNotFoundForFilterClear());
        await waitFor(() => {
          expect(getDashboardsSearch().value).toBe('');
        });
      });
    });

    describe('View mode', () => {
      it('Enters view mode', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        expect(scopesSelectorScene?.state?.isReadOnly).toEqual(true);
        expect(scopesDashboardsScene?.state?.isPanelOpened).toEqual(false);
      });

      it('Closes selector on enter', async () => {
        await userEvents.click(getSelectorInput());
        await act(async () => dashboardScene.onEnterEditMode());
        expect(querySelectorApply()).not.toBeInTheDocument();
      });

      it('Closes dashboards list on enter', async () => {
        await userEvents.click(getDashboardsExpand());
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryDashboardsContainer()).not.toBeInTheDocument();
      });

      it('Does not open selector when view mode is active', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        await userEvents.click(getSelectorInput());
        expect(querySelectorApply()).not.toBeInTheDocument();
      });

      it('Disables the expand button when view mode is active', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        expect(getDashboardsExpand()).toBeDisabled();
      });
    });

    describe('Enrichers', () => {
      it('Data requests', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );
        });

        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );
        });

        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'mimir')
          );
        });
      });

      it('Filters requests', async () => {
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );
        });

        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );
        });

        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'mimir')
          );
        });
      });
    });
  });
});
