import { act, cleanup } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { initializeScopes, scopesDashboardsScene, scopesSelectorScene } from '../instance';
import { getClosestScopesFacade } from '../utils';

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
  let user: UserEvent;

  beforeAll(() => {
    jest.useFakeTimers({ advanceTimers: 1 });
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
  });

  afterEach(async () => {
    await act(async () => jest.runOnlyPendingTimers());
  });

  afterAll(() => {
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
        it('Navigates through scopes nodes', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsCloudExpand());
          await user.click(getResultApplicationsExpand());
        });

        it('Fetches scope details on select', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          expect(fetchScopeSpy).toHaveBeenCalledTimes(1);
        });

        it('Selects the proper scopes', async () => {
          await act(async () =>
            scopesSelectorScene?.updateScopes([
              { scopeName: 'grafana', path: [] },
              { scopeName: 'mimir', path: [] },
            ])
          );
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          expect(getResultApplicationsGrafanaSelect()).toBeChecked();
          expect(getResultApplicationsMimirSelect()).toBeChecked();
        });

        it('Can select scopes from same level', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getResultApplicationsCloudSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Grafana, Mimir, Cloud');
        });

        it('Can select a node from an inner level', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getResultApplicationsCloudExpand());
          await user.click(getResultApplicationsCloudDevSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Dev');
        });

        it('Can select a node from an upper level', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultCloudSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Cloud');
        });

        it('Respects only one select per container', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultCloudExpand());
          await user.click(getResultCloudDevRadio());
          expect(getResultCloudDevRadio().checked).toBe(true);
          expect(getResultCloudOpsRadio().checked).toBe(false);

          await user.click(getResultCloudOpsRadio());
          expect(getResultCloudDevRadio().checked).toBe(false);
          expect(getResultCloudOpsRadio().checked).toBe(true);
        });

        it('Search works', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.type(getTreeSearch(), 'Cloud');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expect(queryResultApplicationsGrafanaTitle()).not.toBeInTheDocument();
          expect(queryResultApplicationsMimirTitle()).not.toBeInTheDocument();
          expect(getResultApplicationsCloudSelect()).toBeInTheDocument();

          await user.clear(getTreeSearch());
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);

          await user.type(getTreeSearch(), 'Grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
          expect(getResultApplicationsGrafanaSelect()).toBeInTheDocument();
          expect(queryResultApplicationsCloudTitle()).not.toBeInTheDocument();
        });

        it('Opens to a selected scope', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultCloudExpand());
          await user.click(getSelectorApply());
          await user.click(getSelectorInput());
          expect(queryResultApplicationsMimirTitle()).toBeInTheDocument();
        });

        it('Persists a scope', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expect(getPersistedApplicationsMimirTitle()).toBeInTheDocument();
          expect(queryPersistedApplicationsGrafanaTitle()).not.toBeInTheDocument();
          expect(queryResultApplicationsMimirTitle()).not.toBeInTheDocument();
          expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
        });

        it('Does not persist a retrieved scope', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'mimir');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expect(queryPersistedApplicationsMimirTitle()).not.toBeInTheDocument();
          expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
        });

        it('Removes persisted nodes', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await user.clear(getTreeSearch());
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
          expect(queryPersistedApplicationsMimirTitle()).not.toBeInTheDocument();
          expect(queryPersistedApplicationsGrafanaTitle()).not.toBeInTheDocument();
          expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
          expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
        });

        it('Persists nodes from search', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.type(getTreeSearch(), 'mimir');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
          expect(getPersistedApplicationsMimirTitle()).toBeInTheDocument();

          await user.clear(getTreeSearch());
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
          expect(getResultApplicationsMimirTitle()).toBeInTheDocument();
          expect(getResultApplicationsGrafanaTitle()).toBeInTheDocument();
        });

        it('Selects a persisted scope', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Mimir, Grafana');
        });

        it('Deselects a persisted scope', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.type(getTreeSearch(), 'grafana');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Mimir, Grafana');

          await user.click(getSelectorInput());
          await user.click(getPersistedApplicationsMimirSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toBe('Grafana');
        });

        it('Shows the proper headline', async () => {
          await user.click(getSelectorInput());
          expect(getTreeHeadline()).toHaveTextContent('Recommended');

          await user.type(getTreeSearch(), 'Applications');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
          expect(getTreeHeadline()).toHaveTextContent('Results');

          await user.type(getTreeSearch(), 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
          expect(getTreeHeadline()).toHaveTextContent('No results found for your query');
        });
      });

      describe('Selector', () => {
        it('Opens', async () => {
          await user.click(getSelectorInput());
          expect(getSelectorApply()).toBeInTheDocument();
        });

        it('Fetches scope details on save', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultCloudSelect());
          await user.click(getSelectorApply());
          expect(fetchSelectedScopesSpy).toHaveBeenCalled();
          expect(getClosestScopesFacade(dashboardScene)?.value).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'cloud')
          );
        });

        it('Does not save the scopes on close', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultCloudSelect());
          await user.click(getSelectorCancel());
          expect(fetchSelectedScopesSpy).not.toHaveBeenCalled();
          expect(getClosestScopesFacade(dashboardScene)?.value).toEqual([]);
        });

        it('Shows selected scopes', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultCloudSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getSelectorInput().value).toEqual('Cloud');
        });

        it('Does not reload the dashboard on scope change', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          expect(locationReloadSpy).not.toHaveBeenCalled();
        });
      });

      describe('Dashboards list', () => {
        it('Toggles expanded state', async () => {
          await user.click(getDashboardsExpand());
          expect(getNotFoundNoScopes()).toBeInTheDocument();
        });

        it('Does not fetch dashboards list when the list is not expanded', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          expect(fetchDashboardsSpy).not.toHaveBeenCalled();
        });

        it('Fetches dashboards list when the list is expanded', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          expect(fetchDashboardsSpy).toHaveBeenCalled();
        });

        it('Fetches dashboards list when the list is expanded after scope selection', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          await user.click(getDashboardsExpand());
          expect(fetchDashboardsSpy).toHaveBeenCalled();
        });

        it('Shows dashboards for multiple scopes', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('General'));
          await user.click(getDashboardFolderExpand('Observability'));
          await user.click(getDashboardFolderExpand('Usage'));
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

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('General'));
          await user.click(getDashboardFolderExpand('Observability'));
          await user.click(getDashboardFolderExpand('Usage'));
          await user.click(getDashboardFolderExpand('Components'));
          await user.click(getDashboardFolderExpand('Investigations'));
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

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('General'));
          await user.click(getDashboardFolderExpand('Observability'));
          await user.click(getDashboardFolderExpand('Usage'));
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
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('General'));
          await user.click(getDashboardFolderExpand('Observability'));
          await user.click(getDashboardFolderExpand('Usage'));
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

          await user.type(getDashboardsSearch(), 'Stats');
          await jest.runOnlyPendingTimersAsync();
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

        it('Filters the dashboards list for folders', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('General'));
          await user.click(getDashboardFolderExpand('Observability'));
          await user.click(getDashboardFolderExpand('Usage'));
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

          await user.type(getDashboardsSearch(), 'Usage');
          await jest.runOnlyPendingTimersAsync();
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

        it('Deduplicates the dashboards list', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsCloudExpand());
          await user.click(getResultApplicationsCloudDevSelect());
          await user.click(getResultApplicationsCloudOpsSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.click(getDashboardFolderExpand('Cardinality Management'));
          await user.click(getDashboardFolderExpand('Usage Insights'));
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
          await user.click(getDashboardsExpand());
          expect(getNotFoundNoScopes()).toBeInTheDocument();
          expect(queryDashboardsSearch()).not.toBeInTheDocument();
        });

        it('Does not show the input when there are no dashboards found for scope', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultCloudSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          expect(getNotFoundForScope()).toBeInTheDocument();
          expect(queryDashboardsSearch()).not.toBeInTheDocument();
        });

        it('Shows the input and a message when there are no dashboards found for filter', async () => {
          await user.click(getDashboardsExpand());
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          await jest.runOnlyPendingTimersAsync();
          await user.type(getDashboardsSearch(), 'unknown');
          await jest.runOnlyPendingTimersAsync();
          expect(queryDashboardsSearch()).toBeInTheDocument();
          expect(getNotFoundForFilter()).toBeInTheDocument();

          await user.click(getNotFoundForFilterClear());
          expect(getDashboardsSearch().value).toBe('');
        });
      });

      describe('View mode', () => {
        it('Enters view mode', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          expect(scopesSelectorScene?.state?.isReadOnly).toEqual(true);
          expect(scopesDashboardsScene?.state?.isPanelOpened).toEqual(false);
        });

        it('Closes selector on enter', async () => {
          await user.click(getSelectorInput());
          await act(async () => dashboardScene.onEnterEditMode());
          expect(querySelectorApply()).not.toBeInTheDocument();
        });

        it('Closes dashboards list on enter', async () => {
          await user.click(getDashboardsExpand());
          await act(async () => dashboardScene.onEnterEditMode());
          expect(queryDashboardsContainer()).not.toBeInTheDocument();
        });

        it('Does not open selector when view mode is active', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          await user.click(getSelectorInput());
          expect(querySelectorApply()).not.toBeInTheDocument();
        });

        it('Disables the expand button when view mode is active', async () => {
          await act(async () => dashboardScene.onEnterEditMode());
          expect(getDashboardsExpand()).toBeDisabled();
        });
      });

      describe('Enrichers', () => {
        it('Data requests', async () => {
          const queryRunner = sceneGraph.getQueryController(dashboardScene)!;

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'mimir')
          );
        });

        it('Filters requests', async () => {
          await user.click(getSelectorInput());
          await user.click(getResultApplicationsExpand());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana')
          );

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsMimirSelect());
          await user.click(getSelectorApply());
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'grafana' || name === 'mimir')
          );

          await user.click(getSelectorInput());
          await user.click(getResultApplicationsGrafanaSelect());
          await user.click(getSelectorApply());
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
            await user.click(getDashboardsExpand());
            await user.click(getSelectorInput());
            await user.click(getResultApplicationsExpand());
            await user.click(getResultApplicationsGrafanaSelect());
            await user.click(getSelectorApply());
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
            await user.click(getDashboardsExpand());
            await user.click(getSelectorInput());
            await user.click(getResultApplicationsExpand());
            await user.click(getResultApplicationsGrafanaSelect());
            await user.click(getSelectorApply());
            expect(locationReloadSpy).toHaveBeenCalled();
          });
        });
      });
    });
  });
});
