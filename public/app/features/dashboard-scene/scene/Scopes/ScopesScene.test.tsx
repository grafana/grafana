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
  fetchSuggestedDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getApplicationsClustersExpand,
  getApplicationsClustersSelect,
  getApplicationsClustersSlothClusterNorthSelect,
  getApplicationsClustersSlothClusterSouthSelect,
  getApplicationsExpand,
  getApplicationsSearch,
  getApplicationsSlothPictureFactorySelect,
  getApplicationsSlothPictureFactoryTitle,
  getApplicationsSlothVoteTrackerSelect,
  getFiltersApply,
  getFiltersCancel,
  getFiltersInput,
  getClustersExpand,
  getClustersSelect,
  getClustersSlothClusterNorthRadio,
  getClustersSlothClusterSouthRadio,
  getDashboard,
  getDashboardsContainer,
  getDashboardsExpand,
  getDashboardsSearch,
  getMock,
  mocksScopes,
  queryAllDashboard,
  queryFiltersApply,
  queryApplicationsClustersTitle,
  queryApplicationsSlothPictureFactoryTitle,
  queryApplicationsSlothVoteTrackerTitle,
  queryDashboard,
  queryDashboardsContainer,
  queryDashboardsExpand,
  renderDashboard,
  getNotFoundForScope,
  queryDashboardsSearch,
  getNotFoundForFilter,
  getClustersSlothClusterEastRadio,
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
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsClustersExpand());
        await userEvents.click(getApplicationsExpand());
      });

      it('Fetches scope details on select', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
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
        await userEvents.click(getApplicationsExpand());
        expect(getApplicationsSlothVoteTrackerSelect()).toBeChecked();
        expect(getApplicationsSlothPictureFactorySelect()).toBeChecked();
      });

      it('Can select scopes from same level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getApplicationsClustersSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothVoteTracker, slothPictureFactory, Cluster Index Helper');
      });

      it('Can select a node from an inner level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getApplicationsClustersExpand());
        await userEvents.click(getApplicationsClustersSlothClusterNorthSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('slothClusterNorth');
      });

      it('Can select a node from an upper level', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getClustersSelect());
        await userEvents.click(getFiltersApply());
        expect(getFiltersInput().value).toBe('Cluster Index Helper');
      });

      it('Respects only one select per container', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersExpand());
        await userEvents.click(getClustersSlothClusterNorthRadio());
        expect(getClustersSlothClusterNorthRadio().checked).toBe(true);
        expect(getClustersSlothClusterSouthRadio().checked).toBe(false);
        await userEvents.click(getClustersSlothClusterSouthRadio());
        expect(getClustersSlothClusterNorthRadio().checked).toBe(false);
        expect(getClustersSlothClusterSouthRadio().checked).toBe(true);
      });

      it('Search works', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.type(getApplicationsSearch(), 'Clusters');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(3));
        expect(queryApplicationsSlothPictureFactoryTitle()).not.toBeInTheDocument();
        expect(queryApplicationsSlothVoteTrackerTitle()).not.toBeInTheDocument();
        expect(getApplicationsClustersSelect()).toBeInTheDocument();
        await userEvents.clear(getApplicationsSearch());
        await userEvents.type(getApplicationsSearch(), 'sloth');
        await waitFor(() => expect(fetchNodesSpy).toHaveBeenCalledTimes(4));
        expect(getApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
        expect(getApplicationsSlothVoteTrackerSelect()).toBeInTheDocument();
        expect(queryApplicationsClustersTitle()).not.toBeInTheDocument();
      });
    });

    describe('Filters', () => {
      it('Opens', async () => {
        await userEvents.click(getFiltersInput());
        expect(getFiltersApply()).toBeInTheDocument();
      });

      it('Fetches scope details on save', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersSelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSelectedScopesSpy).toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'indexHelperCluster')
        );
      });

      it("Doesn't save the scopes on close", async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersSelect());
        await userEvents.click(getFiltersCancel());
        await waitFor(() => expect(fetchSelectedScopesSpy).not.toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual([]);
      });

      it('Shows selected scopes', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersSelect());
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
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).not.toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded after scope selection', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await userEvents.click(getDashboardsExpand());
        await waitFor(() => expect(fetchSuggestedDashboardsSpy).toHaveBeenCalled());
      });

      it('Shows dashboards for multiple scopes', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(queryDashboard('3')).not.toBeInTheDocument();
        expect(queryDashboard('4')).not.toBeInTheDocument();
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(queryDashboard('1')).not.toBeInTheDocument();
        expect(queryDashboard('2')).not.toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
      });

      it('Filters the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        await userEvents.type(getDashboardsSearch(), '1');
        expect(queryDashboard('2')).not.toBeInTheDocument();
      });

      it('Deduplicates the dashboards list', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsClustersExpand());
        await userEvents.click(getApplicationsClustersSlothClusterNorthSelect());
        await userEvents.click(getApplicationsClustersSlothClusterSouthSelect());
        await userEvents.click(getFiltersApply());
        expect(queryAllDashboard('5')).toHaveLength(1);
        expect(queryAllDashboard('6')).toHaveLength(1);
        expect(queryAllDashboard('7')).toHaveLength(1);
        expect(queryAllDashboard('8')).toHaveLength(1);
      });

      it('Does not show the input when there are no dashboards found for scope', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersExpand());
        await userEvents.click(getClustersSlothClusterEastRadio());
        await userEvents.click(getFiltersApply());
        expect(getNotFoundForScope()).toBeInTheDocument();
        expect(queryDashboardsSearch()).not.toBeInTheDocument();
      });

      it('Does show the input and a message when there are no dashboards found for filter', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await userEvents.type(getDashboardsSearch(), 'unknown');
        expect(queryDashboardsSearch()).toBeInTheDocument();
        expect(getNotFoundForFilter()).toBeInTheDocument();
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
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothPictureFactory')
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
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
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
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
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothPictureFactory')
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => {
          expect(dashboardScene.enrichFiltersRequest().scopes).toEqual(
            mocksScopes.filter(
              ({ metadata: { name } }) => name === 'slothPictureFactory' || name === 'slothVoteTracker'
            )
          );
        });

        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
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
