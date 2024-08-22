import { act, cleanup, waitFor } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { getDashboardAPI, setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { initializeScopes, scopesDashboardsScene, scopesSelectorScene } from './instance';
import {
  buildTestScene,
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getDashboard,
  getDashboardsExpand,
  getDashboardsSearch,
  getMock,
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
  getResultCloudProdRadio,
  getResultCloudSelect,
  getSelectorApply,
  getSelectorCancel,
  getSelectorInput,
  getTreeHeadline,
  getTreeSearch,
  mocksScopes,
  queryAllDashboard,
  queryDashboard,
  queryDashboardsContainer,
  queryDashboardsSearch,
  queryPersistedApplicationsGrafanaTitle,
  queryPersistedApplicationsMimirTitle,
  queryResultApplicationsCloudTitle,
  queryResultApplicationsGrafanaTitle,
  queryResultApplicationsMimirTitle,
  querySelectorApply,
  renderDashboard,
  resetScenes,
} from './testUtils';
import { getClosestScopesFacade } from './utils';

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
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(queryDashboard('3')).not.toBeInTheDocument();
        expect(queryDashboard('4')).not.toBeInTheDocument();
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsGrafanaSelect());
        await userEvents.click(getSelectorApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        expect(queryDashboard('1')).not.toBeInTheDocument();
        expect(queryDashboard('2')).not.toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
      });

      it('Filters the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsMimirSelect());
        await userEvents.click(getSelectorApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        await userEvents.type(getDashboardsSearch(), '1');
        expect(queryDashboard('2')).not.toBeInTheDocument();
      });

      it('Deduplicates the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsCloudExpand());
        await userEvents.click(getResultApplicationsCloudDevSelect());
        await userEvents.click(getResultApplicationsCloudOpsSelect());
        await userEvents.click(getSelectorApply());
        expect(queryAllDashboard('5')).toHaveLength(1);
        expect(queryAllDashboard('6')).toHaveLength(1);
        expect(queryAllDashboard('7')).toHaveLength(1);
        expect(queryAllDashboard('8')).toHaveLength(1);
      });

      it('Shows a proper message when no scopes are selected', async () => {
        await userEvents.click(getDashboardsExpand());
        expect(getNotFoundNoScopes()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Does not show the input when there are no dashboards found for scope', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getSelectorInput());
        await userEvents.click(getResultCloudExpand());
        await userEvents.click(getResultCloudProdRadio());
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
        expect(queryDashboardsSearch()).toBeInTheDocument();
        expect(getNotFoundForFilter()).toBeInTheDocument();
        await userEvents.click(getNotFoundForFilterClear());
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

  describe('Dashboards API', () => {
    describe('Feature flag off', () => {
      beforeAll(() => {
        config.featureToggles.scopeFilters = true;
        config.featureToggles.passScopeToDashboardApi = false;
      });

      beforeEach(() => {
        setDashboardAPI(undefined);
        locationService.push('/?scopes=scope1&scopes=scope2&scopes=scope3');
      });

      afterEach(() => {
        resetScenes();
        cleanup();
      });

      it('Legacy API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = false;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', undefined);
      });

      it('K8s API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = true;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/1/dto'
        );
      });
    });

    describe('Feature flag on', () => {
      beforeAll(() => {
        config.featureToggles.scopeFilters = true;
        config.featureToggles.passScopeToDashboardApi = true;
      });

      beforeEach(() => {
        setDashboardAPI(undefined);
        locationService.push('/?scopes=scope1&scopes=scope2&scopes=scope3');
        initializeScopes();
      });

      afterEach(() => {
        resetScenes();
        cleanup();
      });

      it('Legacy API should pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = false;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', { scopes: ['scope1', 'scope2', 'scope3'] });
      });

      it('K8s API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = true;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/1/dto'
        );
      });
    });
  });
});
