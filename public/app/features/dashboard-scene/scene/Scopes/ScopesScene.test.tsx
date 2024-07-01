import { act, cleanup, waitFor } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { config, locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { getDashboardAPI, setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import {
  buildTestScene,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  fetchSuggestedDashboardsSpy,
  getDashboard,
  getDashboardsContainer,
  getDashboardsExpand,
  getDashboardsSearch,
  getFiltersApply,
  getFiltersCancel,
  getFiltersInput,
  getMock,
  getNotFoundForFilter,
  getNotFoundForFilterClear,
  getNotFoundForScope,
  getNotFoundNoScopes,
  getPersistedApplicationsSlothPictureFactorySelect,
  getPersistedApplicationsSlothPictureFactoryTitle,
  getPersistedApplicationsSlothVoteTrackerTitle,
  getResultApplicationsClustersExpand,
  getResultApplicationsClustersSelect,
  getResultApplicationsClustersSlothClusterNorthSelect,
  getResultApplicationsClustersSlothClusterSouthSelect,
  getResultApplicationsExpand,
  getResultApplicationsSlothPictureFactorySelect,
  getResultApplicationsSlothPictureFactoryTitle,
  getResultApplicationsSlothVoteTrackerSelect,
  getResultApplicationsSlothVoteTrackerTitle,
  getResultClustersExpand,
  getResultClustersSelect,
  getResultClustersSlothClusterEastRadio,
  getResultClustersSlothClusterNorthRadio,
  getResultClustersSlothClusterSouthRadio,
  getTreeHeadline,
  getTreeSearch,
  mocksScopes,
  queryAllDashboard,
  queryDashboard,
  queryDashboardsContainer,
  queryDashboardsExpand,
  queryDashboardsSearch,
  queryFiltersApply,
  queryPersistedApplicationsSlothPictureFactoryTitle,
  queryPersistedApplicationsSlothVoteTrackerTitle,
  queryResultApplicationsClustersTitle,
  queryResultApplicationsSlothPictureFactoryTitle,
  queryResultApplicationsSlothVoteTrackerTitle,
  renderDashboard,
} from './testUtils';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: getMock,
  }),
}));

describe('ScopesScene', () => {
  describe('Feature flag off', () => {
    beforeAll(() => {
      config.featureToggles.scopeFilters = false;
    });

    it('Does not initialize', () => {
      const dashboardScene = buildTestScene();
      dashboardScene.activate();
      expect(dashboardScene.state.scopes).toBeUndefined();
    });
  });

  describe('Feature flag on', () => {
    let dashboardScene: DashboardScene;
    let scopesScene: ScopesScene;
    let filtersScene: ScopesFiltersScene;

    beforeAll(() => {
      config.featureToggles.scopeFilters = true;
    });

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(jest.fn());

      fetchNodesSpy.mockClear();
      fetchScopeSpy.mockClear();
      fetchSelectedScopesSpy.mockClear();
      fetchSuggestedDashboardsSpy.mockClear();
      getMock.mockClear();

      dashboardScene = buildTestScene();
      scopesScene = dashboardScene.state.scopes!;
      filtersScene = scopesScene.state.filters;

      renderDashboard(dashboardScene);
    });

    afterEach(() => {
      cleanup();
    });

    describe('Tree', () => {
      it('Navigates through scopes nodes', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsClustersExpand());
        await userEvents.click(getResultApplicationsExpand());
      });

      it('Fetches scope details on select', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await waitFor(() => expect(fetchScopeSpy).toHaveBeenCalledTimes(1));
      });

      it('Selects the proper scopes', async () => {
        await act(async () =>
          filtersScene.updateScopes([
            { scopeName: 'slothPictureFactory', path: [] },
            { scopeName: 'slothVoteTracker', path: [] },
          ])
        );
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        expect(getResultApplicationsSlothVoteTrackerSelect()).toBeChecked();
        expect(getResultApplicationsSlothPictureFactorySelect()).toBeChecked();
      });

      it('Can select scopes from same level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getResultApplicationsClustersSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothVoteTracker, slothPictureFactory, Cluster Index Helper');
      });

      it('Can select a node from an inner level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getResultApplicationsClustersExpand());
        await userEvents.click(getResultApplicationsClustersSlothClusterNorthSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothClusterNorth');
      });

      it('Can select a node from an upper level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultClustersSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('Cluster Index Helper');
      });

      it('Respects only one select per container', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultClustersExpand());
        await userEvents.click(getResultClustersSlothClusterNorthRadio());
        expect(getResultClustersSlothClusterNorthRadio().checked).toBe(true);
        expect(getResultClustersSlothClusterSouthRadio().checked).toBe(false);
        await userEvents.click(getResultClustersSlothClusterSouthRadio());
        expect(getResultClustersSlothClusterNorthRadio().checked).toBe(false);
        expect(getResultClustersSlothClusterSouthRadio().checked).toBe(true);
      });

      it('Search works', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.type(getTreeSearch(), 'Clusters');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(queryResultApplicationsSlothPictureFactoryTitle()).not.toBeInTheDocument();
        expect(queryResultApplicationsSlothVoteTrackerTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsClustersSelect()).toBeInTheDocument();
        await userEvents.clear(getTreeSearch());
        await userEvents.type(getTreeSearch(), 'sloth');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(getResultApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(getResultApplicationsSlothVoteTrackerSelect()).toBeInTheDocument();
        expect(queryResultApplicationsClustersTitle()).not.toBeInTheDocument();
      });

      it('Opens to a selected scope', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultClustersExpand());
        await userEvents.click(getFiltersApply());
        await userEvents.click(getFiltersInput());
        expect(queryResultApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
      });

      it('Persists a scope', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.type(getTreeSearch(), 'slothVoteTracker');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(getPersistedApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(queryPersistedApplicationsSlothVoteTrackerTitle()).not.toBeInTheDocument();
        expect(queryResultApplicationsSlothPictureFactoryTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsSlothVoteTrackerTitle()).toBeInTheDocument();
      });

      it('Does not persist a retrieved scope', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.type(getTreeSearch(), 'slothPictureFactory');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(queryPersistedApplicationsSlothPictureFactoryTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
      });

      it('Removes persisted nodes', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.type(getTreeSearch(), 'slothVoteTracker');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.clear(getTreeSearch());
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(queryPersistedApplicationsSlothPictureFactoryTitle()).not.toBeInTheDocument();
        expect(queryPersistedApplicationsSlothVoteTrackerTitle()).not.toBeInTheDocument();
        expect(getResultApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(getResultApplicationsSlothVoteTrackerTitle()).toBeInTheDocument();
      });

      it('Persists nodes from search', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.type(getTreeSearch(), 'sloth');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.type(getTreeSearch(), 'slothunknown');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(getPersistedApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(getPersistedApplicationsSlothVoteTrackerTitle()).toBeInTheDocument();
        await userEvents.clear(getTreeSearch());
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(5));
        expect(getResultApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(getResultApplicationsSlothVoteTrackerTitle()).toBeInTheDocument();
      });

      it('Selects a persisted scope', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.type(getTreeSearch(), 'slothVoteTracker');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothPictureFactory, slothVoteTracker');
      });

      it('Deselects a persisted scope', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.type(getTreeSearch(), 'slothVoteTracker');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothPictureFactory, slothVoteTracker');
        await userEvents.click(getFiltersInput());
        await userEvents.click(getPersistedApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothVoteTracker');
      });

      it('Shows the proper headline', async () => {
        await userEvents.click(getFiltersInput());
        expect(getTreeHeadline()).toHaveTextContent('Recommended');
        await userEvents.type(getTreeSearch(), 'Applications');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(2));
        expect(getTreeHeadline()).toHaveTextContent('Results');
        await userEvents.type(getTreeSearch(), 'unknown');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(getTreeHeadline()).toHaveTextContent('No results found for your query');
      });
    });

    describe('Filters', () => {
      it('Opens', async () => {
        await userEvents.click(getFiltersInput());
        expect(getFiltersApply()).toBeInTheDocument();
      });

      it('Fetches scope details on save', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultClustersSelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSelectedScopesSpy).toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'indexHelperCluster')
        );
      });

      it("Doesn't save the scopes on close", async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultClustersSelect());
        await userEvents.click(getFiltersCancel());
        await waitFor(() => expect(fetchSelectedScopesSpy).not.toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual([]);
      });

      it('Shows selected scopes', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultClustersSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toEqual('Cluster Index Helper');
      });
    });

    describe('Dashboards list', () => {
      it('Toggles expanded state', async () => {
        await userEvents.click(getDashboardsExpand());
        expect(getDashboardsContainer()).toBeInTheDocument();
      });

      it('Does not fetch dashboards list when the list is not expanded', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).not.toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded after scope selection', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await userEvents.click(getDashboardsExpand());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).toHaveBeenCalled());
      });

      it('Shows dashboards for multiple scopes', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(queryDashboard('3')).not.toBeInTheDocument();
        expect(queryDashboard('4')).not.toBeInTheDocument();
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(queryDashboard('1')).not.toBeInTheDocument();
        expect(queryDashboard('2')).not.toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
      });

      it('Filters the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        await userEvents.type(getDashboardsSearch(), '1');
        expect(queryDashboard('2')).not.toBeInTheDocument();
      });

      it('Deduplicates the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsClustersExpand());
        await userEvents.click(getResultApplicationsClustersSlothClusterNorthSelect());
        await userEvents.click(getResultApplicationsClustersSlothClusterSouthSelect());
        await userEvents.click(getFiltersApply());
        expect(queryAllDashboard('5')).toHaveLength(1);
        expect(queryAllDashboard('6')).toHaveLength(1);
        expect(queryAllDashboard('7')).toHaveLength(1);
        expect(queryAllDashboard('8')).toHaveLength(1);
      });

      it('Does show a proper message when no scopes are selected', async () => {
        await userEvents.click(getDashboardsExpand());
        expect(getNotFoundNoScopes()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Does not show the input when there are no dashboards found for scope', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultClustersExpand());
        await userEvents.click(getResultClustersSlothClusterEastRadio());
        await userEvents.click(getFiltersApply());
        expect(getNotFoundForScope()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Does show the input and a message when there are no dashboards found for filter', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
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
        expect(scopesScene.state.isViewing).toEqual(true);
        expect(scopesScene.state.isExpanded).toEqual(false);
      });

      it('Closes filters on enter', async () => {
        await userEvents.click(getFiltersInput());
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryFiltersApply()).not.toBeInTheDocument();
      });

      it('Closes dashboards list on enter', async () => {
        await userEvents.click(getDashboardsExpand());
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryDashboardsContainer()).not.toBeInTheDocument();
      });

      it('Does not open filters when view mode is active', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        await userEvents.click(getFiltersInput());
        expect(queryFiltersApply()).not.toBeInTheDocument();
      });

      it('Hides the expand button when view mode is active', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryDashboardsExpand()).not.toBeInTheDocument();
      });
    });

    describe('Enrichers', () => {
      it('Data requests', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothPictureFactory')
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(
              ({ metadata: { name } }) => name === 'slothPictureFactory' || name === 'slothVoteTracker'
            )
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothVoteTracker')
          );
        });
      });

      it('Filters requests', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsExpand());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothPictureFactory')
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(
              ({ metadata: { name } }) => name === 'slothPictureFactory' || name === 'slothVoteTracker'
            )
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getResultApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothVoteTracker')
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

      it('Legacy API should not pass the scopes', () => {
        config.featureToggles.kubernetesDashboards = false;
        getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', undefined);
      });

      it('K8s API should not pass the scopes', () => {
        config.featureToggles.kubernetesDashboards = true;
        getDashboardAPI().getDashboardDTO('1');
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
      });

      it('Legacy API should pass the scopes', () => {
        config.featureToggles.kubernetesDashboards = false;
        getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', { scopes: ['scope1', 'scope2', 'scope3'] });
      });

      it('K8s API should not pass the scopes', () => {
        config.featureToggles.kubernetesDashboards = true;
        getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/1/dto'
        );
      });
    });
  });
});
