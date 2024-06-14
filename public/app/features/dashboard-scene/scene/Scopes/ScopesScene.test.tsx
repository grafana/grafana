import { act, cleanup, waitFor } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import {
  buildTestScene,
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchScopesSpy,
  getApplicationsClustersExpand,
  getApplicationsClustersSelect,
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
  getClustersSlothClusterNorthSelect,
  getClustersSlothClusterSouthSelect,
  getDashboard,
  getDashboardsContainer,
  getDashboardsExpand,
  getDashboardsSearch,
  mocksNodes,
  mocksScopeDashboardBindings,
  mocksScopes,
  queryFiltersApply,
  queryApplicationsClustersSlothClusterNorthTitle,
  queryApplicationsClustersTitle,
  queryApplicationsSlothPictureFactoryTitle,
  queryApplicationsSlothVoteTrackerTitle,
  queryDashboard,
  queryDashboardsContainer,
  queryDashboardsExpand,
  renderDashboard,
} from './testUtils';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string, params: { parent: string; scope: string[]; query?: string }) => {
      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_node_children')) {
        return {
          items: mocksNodes.filter(
            ({ parent, spec: { title } }) => parent === params.parent && title.includes(params.query ?? '')
          ),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

        return mocksScopes.find((scope) => scope.metadata.name === name) ?? {};
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_dashboard_bindings')) {
        return {
          items: mocksScopeDashboardBindings.filter(({ spec: { scope: bindingScope } }) =>
            params.scope.includes(bindingScope)
          ),
        };
      }

      return {};
    }),
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
      fetchScopesSpy.mockClear();
      fetchDashboardsSpy.mockClear();

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
        await act(async () => filtersScene.updateScopes(['slothPictureFactory', 'slothVoteTracker']));
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

      it("Can't navigate deeper than the level where scopes are selected", async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothVoteTrackerSelect());
        await userEvents.click(getApplicationsClustersExpand());
        expect(queryApplicationsClustersSlothClusterNorthTitle()).not.toBeInTheDocument();
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
        await userEvents.click(getClustersSlothClusterNorthSelect());
        expect(getClustersSlothClusterSouthSelect()).toBeDisabled();
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
        await waitFor(() => expect(fetchScopesSpy).toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'indexHelperCluster')
        );
      });

      it("Doesn't save the scopes on close", async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getClustersSelect());
        await userEvents.click(getFiltersCancel());
        await waitFor(() => expect(fetchScopesSpy).not.toHaveBeenCalled());
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
        await waitFor(() => expect(fetchDashboardsSpy).not.toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded', async () => {
        await userEvents.click(getDashboardsExpand());
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded after scope selection', async () => {
        await userEvents.click(getFiltersInput());
        await userEvents.click(getApplicationsExpand());
        await userEvents.click(getApplicationsSlothPictureFactorySelect());
        await userEvents.click(getFiltersApply());
        await userEvents.click(getDashboardsExpand());
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
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
});
