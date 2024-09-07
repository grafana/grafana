import { act, cleanup } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { initializeScopes, scopesDashboardsScene, scopesSelectorScene } from '../instance';
import { getClosestScopesFacade } from '../utils';

import { clear, click, type } from './utils/actions';
import {
  expandDashboardFolder,
  expectChecked,
  expectDashboardFolderNotInDocument,
  expectDashboardInDocument,
  expectDashboardLength,
  expectDashboardNotInDocument,
  expectDisabled,
  expectInDocument,
  expectNotInDocument,
  expectRadioChecked,
  expectRadioNotChecked,
  expectTextContent,
  expectValue,
} from './utils/assertions';
import {
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getMock,
  locationReloadSpy,
  mocksScopes,
} from './utils/mocks';
import { buildTestScene, renderDashboard, resetScenes } from './utils/render';
import {
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
  queryDashboardsContainer,
  queryDashboardsSearch,
  queryPersistedApplicationsGrafanaTitle,
  queryPersistedApplicationsMimirTitle,
  queryResultApplicationsCloudTitle,
  queryResultApplicationsGrafanaTitle,
  queryResultApplicationsMimirTitle,
  querySelectorApply,
} from './utils/selectors';

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
  getBackendSrv: () => ({
    get: getMock,
  }),
  getDataSourceSrv: () => ({
    get: async (ref: DataSourceRef) => {
      if (ref.uid === '-- Grafana --') {
        return {
          id: 1,
          uid: '-- Grafana --',
          name: 'grafana',
          type: 'grafana',
          meta: {
            id: 'grafana',
          },
        };
      }

      return {
        meta: {
          id: 'grafana-testdata-datasource',
        },
        name: 'grafana-testdata-datasource',
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
        getRef: () => {
          return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
        },
      };
    },
    getInstanceSettings: () => ({
      id: 1,
      uid: 'gdev-testdata',
      name: 'testDs1',
      type: 'grafana-testdata-datasource',
      meta: {
        id: 'grafana-testdata-datasource',
      },
    }),
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
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(async () => {
    await jest.runOnlyPendingTimersAsync();
    jest.useRealTimers();
  });

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
      locationReloadSpy.mockClear();
      getMock.mockClear();

      initializeScopes();
    });

    afterEach(() => {
      resetScenes();
      cleanup();
    });

    describe('Without dashboards reload', () => {
      beforeEach(() => {
        dashboardScene = buildTestScene();

        renderDashboard(dashboardScene);
      });

      describe('Tree', () => {
        it('Fetches scope details on select', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          expect(fetchScopeSpy).toHaveBeenCalledTimes(1);
        });

        it('Selects the proper scopes', async () => {
          await act(async () =>
            scopesSelectorScene?.updateScopes([
              { scopeName: 'grafana', path: [] },
              { scopeName: 'mimir', path: [] },
            ])
          );
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          expectChecked(getResultApplicationsGrafanaSelect);
          expectChecked(getResultApplicationsMimirSelect);
        });

        it('Can select scopes from same level', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getResultApplicationsMimirSelect);
          await click(getResultApplicationsCloudSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Grafana, Mimir, Cloud');
        });

        it('Can select a node from an inner level', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getResultApplicationsCloudExpand);
          await click(getResultApplicationsCloudDevSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Dev');
        });

        it('Can select a node from an upper level', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getResultApplicationsExpand);
          await click(getResultCloudSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Cloud');
        });

        it('Respects only one select per container', async () => {
          await click(getSelectorInput);
          await click(getResultCloudExpand);
          await click(getResultCloudDevRadio);
          expectRadioChecked(getResultCloudDevRadio);
          expectRadioNotChecked(getResultCloudOpsRadio);

          await click(getResultCloudOpsRadio);
          expectRadioNotChecked(getResultCloudDevRadio);
          expectRadioChecked(getResultCloudOpsRadio);
        });

        it('Search works', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await type(getTreeSearch, 'Cloud');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expectNotInDocument(queryResultApplicationsGrafanaTitle);
          expectNotInDocument(queryResultApplicationsMimirTitle);
          expectInDocument(getResultApplicationsCloudSelect);

          await clear(getTreeSearch);
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);

          await type(getTreeSearch, 'Grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
          expectInDocument(getResultApplicationsGrafanaSelect);
          expectNotInDocument(queryResultApplicationsCloudTitle);
        });

        it('Opens to a selected scope', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await click(getResultApplicationsExpand);
          await click(getResultCloudExpand);
          await click(getSelectorApply);
          await click(getSelectorInput);
          expectInDocument(getResultApplicationsMimirTitle);
        });

        it('Persists a scope', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expectInDocument(getPersistedApplicationsMimirTitle);
          expectNotInDocument(queryPersistedApplicationsGrafanaTitle);
          expectNotInDocument(queryResultApplicationsMimirTitle);
          expectInDocument(getResultApplicationsGrafanaTitle);
        });

        it('Does not persist a retrieved scope', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'mimir');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expectNotInDocument(queryPersistedApplicationsMimirTitle);
          expectInDocument(getResultApplicationsMimirTitle);
        });

        it('Removes persisted nodes', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await clear(getTreeSearch);
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
          expectNotInDocument(queryPersistedApplicationsMimirTitle);
          expectNotInDocument(queryPersistedApplicationsGrafanaTitle);
          expectInDocument(getResultApplicationsMimirTitle);
          expectInDocument(getResultApplicationsGrafanaTitle);
        });

        it('Persists nodes from search', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await type(getTreeSearch, 'mimir');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
          expectInDocument(getPersistedApplicationsMimirTitle);

          await clear(getTreeSearch);
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
          expectInDocument(getResultApplicationsMimirTitle);
          expectInDocument(getResultApplicationsGrafanaTitle);
        });

        it('Selects a persisted scope', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Mimir, Grafana');
        });

        it('Deselects a persisted scope', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await type(getTreeSearch, 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Mimir, Grafana');

          await click(getSelectorInput);
          await click(getPersistedApplicationsMimirSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Grafana');
        });

        it('Shows the proper headline', async () => {
          await click(getSelectorInput);
          expectTextContent(getTreeHeadline, 'Recommended');

          await type(getTreeSearch, 'Applications');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
          expectTextContent(getTreeHeadline, 'Results');

          await type(getTreeSearch, 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expectTextContent(getTreeHeadline, 'No results found for your query');
        });
      });

      describe('Selector', () => {
        it('Opens', async () => {
          await click(getSelectorInput);
          expectInDocument(getSelectorApply);
        });

        it('Fetches scope details on save', async () => {
          await click(getSelectorInput);
          await click(getResultCloudSelect);
          await click(getSelectorApply);
          expect(fetchSelectedScopesSpy).toHaveBeenCalled();
          expect(getClosestScopesFacade(dashboardScene)?.value).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'cloud')
          );
        });

        it('Does not save the scopes on close', async () => {
          await click(getSelectorInput);
          await click(getResultCloudSelect);
          await click(getSelectorCancel);
          expect(fetchSelectedScopesSpy).not.toHaveBeenCalled();
          expect(getClosestScopesFacade(dashboardScene)?.value).toEqual([]);
        });

        it('Shows selected scopes', async () => {
          await click(getSelectorInput);
          await click(getResultCloudSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectValue(getSelectorInput, 'Cloud');
        });

        it('Does not reload the dashboard on scope change', async () => {
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          expect(locationReloadSpy).not.toHaveBeenCalled();
        });
      });

      describe('Dashboards list', () => {
        it('Toggles expanded state', async () => {
          await click(getDashboardsExpand);
          expectInDocument(getNotFoundNoScopes);
        });

        it('Does not fetch dashboards list when the list is not expanded', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          expect(fetchDashboardsSpy).not.toHaveBeenCalled();
        });

        it('Fetches dashboards list when the list is expanded', async () => {
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          expect(fetchDashboardsSpy).toHaveBeenCalled();
        });

        it('Fetches dashboards list when the list is expanded after scope selection', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          await click(getDashboardsExpand);
          expect(fetchDashboardsSpy).toHaveBeenCalled();
        });

        it('Shows dashboards for multiple scopes', async () => {
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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

          await click(getSelectorInput);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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

          await click(getSelectorInput);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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

          await type(getDashboardsSearch, 'Stats');
          await jest.runOnlyPendingTimersAsync();
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
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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

          await type(getDashboardsSearch, 'Usage');
          await jest.runOnlyPendingTimersAsync();
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
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsCloudExpand);
          await click(getResultApplicationsCloudDevSelect);
          await click(getResultApplicationsCloudOpsSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
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
          await click(getDashboardsExpand);
          expectInDocument(getNotFoundNoScopes);
          expectNotInDocument(queryDashboardsSearch);
        });

        it('Does not show the input when there are no dashboards found for scope', async () => {
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultCloudSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          expectInDocument(getNotFoundForScope);
          expectNotInDocument(queryDashboardsSearch);
        });

        it('Shows the input and a message when there are no dashboards found for filter', async () => {
          await click(getDashboardsExpand);
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          await jest.runOnlyPendingTimersAsync();
          await type(getDashboardsSearch, 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expectInDocument(getDashboardsSearch);
          expectInDocument(getNotFoundForFilter);

          await click(getNotFoundForFilterClear);
          expectValue(getDashboardsSearch, '');
        });
      });

      describe('View mode', () => {
        it('Enters view mode', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          expect(scopesSelectorScene?.state?.isReadOnly).toEqual(true);
          expect(scopesDashboardsScene?.state?.isPanelOpened).toEqual(false);
        });

        it('Closes selector on enter', async () => {
          await click(getSelectorInput);
          await act(async () => dashboardScene.onEnterEditMode());
          expectNotInDocument(querySelectorApply);
        });

        it('Closes dashboards list on enter', async () => {
          await click(getDashboardsExpand);
          await act(async () => dashboardScene.onEnterEditMode());
          expectNotInDocument(queryDashboardsContainer);
        });

        it('Does not open selector when view mode is active', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          await click(getSelectorInput);
          expectNotInDocument(querySelectorApply);
        });

        it('Disables the expand button when view mode is active', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          expectDisabled(getDashboardsExpand);
        });
      });

      describe('Enrichers', () => {
        it('Data requests', async () => {
          const queryRunner = sceneGraph.getQueryController(dashboardScene)!;

          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );

          await click(getSelectorInput);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );

          await click(getSelectorInput);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'mimir')
          );
        });

        it('Filters requests', async () => {
          await click(getSelectorInput);
          await click(getResultApplicationsExpand);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );

          await click(getSelectorInput);
          await click(getResultApplicationsMimirSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );

          await click(getSelectorInput);
          await click(getResultApplicationsGrafanaSelect);
          await click(getSelectorApply);
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'mimir')
          );
        });
      });
    });

    describe('With dashboards reload', () => {
      describe('Without dashboard UID', () => {
        beforeEach(() => {
          dashboardScene = buildTestScene({ uid: undefined }, { reloadOnScopesChange: true });

          renderDashboard(dashboardScene);
        });

        describe('Selector', () => {
          it('Does not reload the dashboard on scopes change', async () => {
            await click(getDashboardsExpand);
            await click(getSelectorInput);
            await click(getResultApplicationsExpand);
            await click(getResultApplicationsGrafanaSelect);
            await click(getSelectorApply);
            expect(locationReloadSpy).not.toHaveBeenCalled();
          });
        });
      });

      describe('With dashboard UID', () => {
        beforeEach(() => {
          dashboardScene = buildTestScene({}, { reloadOnScopesChange: true });

          renderDashboard(dashboardScene);
        });

        describe('Selector', () => {
          it('Reloads the dashboard on scopes change', async () => {
            await click(getDashboardsExpand);
            await click(getSelectorInput);
            await click(getResultApplicationsExpand);
            await click(getResultApplicationsGrafanaSelect);
            await click(getSelectorApply);
            expect(locationReloadSpy).toHaveBeenCalled();
          });
        });
      });
    });
  });
});
