import { act, cleanup, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import {
  buildTestScene,
  clickAdvancedApply,
  clickAdvancedCancel,
  clickApplicationsClustersExpand,
  clickApplicationsExpand,
  clickApplicationsSlothPictureFactorySelect,
  clickApplicationsSlothVoteTrackerSelect,
  clickBasicInput,
  clickBasicOpenAdvanced,
  clickClustersSelect,
  clickRootExpand,
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchScopesSpy,
  getAdvancedApply,
  getApplicationsSlothPictureFactoryTitle,
  getBasicInnerContainer,
  getBasicInput,
  getDashboard,
  getDashboardsContainer,
  mocksNodes,
  mocksScopeDashboardBindings,
  mocksScopes,
  queryAdvancedApply,
  queryBasicInnerContainer,
  queryDashboard,
  renderDashboard,
  scopesNamesPaths,
} from './testUtils';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string, params: { fieldSelector: string; parent: string }) => {
      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find')) {
        return {
          items: mocksNodes.filter((node) => node.parent === params.parent),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

        return mocksScopes.find((scope) => scope.metadata.name === name) ?? {};
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopedashboardbindings')) {
        const scope = params.fieldSelector.replace('spec.scope=', '') ?? '';

        return {
          items: mocksScopeDashboardBindings.filter(({ spec: { scope: bindingScope } }) => bindingScope === scope),
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
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsClustersExpand();
        await clickApplicationsExpand();
      });

      it('Fetches sub-nodes on expand', () => {
        filtersScene.updateNode(scopesNamesPaths[0], true, '');
        expect(fetchNodesSpy).toHaveBeenCalled();
      });

      it('Fetches scope details on select', () => {
        filtersScene.updateNode(scopesNamesPaths[0], true, '');
        filtersScene.toggleNodeSelect(scopesNamesPaths[0]);
        expect(fetchScopeSpy).toHaveBeenCalled();
      });

      it('Selects the proper scopes', () => {});

      it("Doesn't refetch the scope details on subsequent selects", () => {});

      it('Can select scopes from same level', () => {});

      it("Can't navigate deeper than the level where scopes are selected", () => {});

      it('Can select a node from an upper level', () => {});

      it('Can select a node from an upper level', () => {});
    });

    describe('Basic selector', () => {
      it('Opens', async () => {
        await clickBasicInput();
        expect(getBasicInnerContainer()).toBeInTheDocument();
      });

      it('Fetches scope details on save', async () => {
        await clickBasicInput();
        await clickClustersSelect();
        await clickBasicInput();
        await waitFor(() => expect(fetchScopesSpy).toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'indexHelperCluster')
        );
      });

      it('Shows selected scopes', async () => {
        await clickBasicInput();
        await clickClustersSelect();
        await clickBasicInput();
        expect(getBasicInput().value).toEqual('Cluster Index Helper');
      });
    });

    describe('Advanced selector', () => {
      it('Opens', async () => {
        await clickBasicInput();
        await clickBasicOpenAdvanced();
        expect(queryBasicInnerContainer()).not.toBeInTheDocument();
        expect(getAdvancedApply()).toBeInTheDocument();
      });

      it('Fetches scope details on save', async () => {
        await clickBasicInput();
        await clickBasicOpenAdvanced();
        await clickClustersSelect();
        await clickAdvancedApply();
        await waitFor(() => expect(fetchScopesSpy).toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual(
          mocksScopes.filter(({ metadata: { name } }) => name === 'indexHelperCluster')
        );
      });

      it("Doesn't save the scopes on close", async () => {
        await clickBasicInput();
        await clickBasicOpenAdvanced();
        await clickClustersSelect();
        await clickAdvancedCancel();
        await waitFor(() => expect(fetchScopesSpy).not.toHaveBeenCalled());
        expect(filtersScene.getSelectedScopes()).toEqual([]);
      });
    });

    describe('Selectors interoperability', () => {
      it('Replicates the same structure from basic to advanced selector', async () => {
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickBasicOpenAdvanced();
        expect(getApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
      });

      it('Replicates the same structure from advanced to basic selector', async () => {
        await clickBasicInput();
        await clickBasicOpenAdvanced();
        await clickApplicationsExpand();
        await clickAdvancedApply();
        await clickBasicInput();
        expect(getApplicationsSlothPictureFactoryTitle()).toBeInTheDocument();
      });
    });

    describe('Dashboards list', () => {
      it('Toggles expanded state', async () => {
        await clickRootExpand();
        expect(getDashboardsContainer()).toBeInTheDocument();
      });

      it('Does not fetch dashboards list when the list is not expanded', async () => {
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        await waitFor(() => expect(fetchDashboardsSpy).not.toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded', async () => {
        await clickRootExpand();
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
      });

      it('Fetches dashboards list when the list is expanded after scope selection', async () => {
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        await clickRootExpand();
        await waitFor(() => expect(fetchDashboardsSpy).toHaveBeenCalled());
      });

      it('Shows dashboards for multiple scopes', async () => {
        await clickRootExpand();
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(queryDashboard('3')).not.toBeInTheDocument();
        expect(queryDashboard('4')).not.toBeInTheDocument();
        await clickBasicInput();
        await clickApplicationsSlothVoteTrackerSelect();
        await clickBasicInput();
        expect(getDashboard('1')).toBeInTheDocument();
        expect(getDashboard('2')).toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
        await clickBasicInput();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        expect(queryDashboard('1')).not.toBeInTheDocument();
        expect(queryDashboard('2')).not.toBeInTheDocument();
        expect(getDashboard('3')).toBeInTheDocument();
        expect(getDashboard('4')).toBeInTheDocument();
      });
    });

    describe('View mode', () => {
      it('Enters view mode', async () => {
        await act(async () => dashboardScene.onEnterEditMode());
        expect(scopesScene.state.isViewing).toEqual(true);
        expect(scopesScene.state.isExpanded).toEqual(false);
      });

      it('Closes basic selector on enter', async () => {
        await clickBasicInput();
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryBasicInnerContainer()).not.toBeInTheDocument();
      });

      it('Closes advanced selector on enter', async () => {
        await clickBasicInput();
        await clickBasicOpenAdvanced();
        await act(async () => dashboardScene.onEnterEditMode());
        expect(queryAdvancedApply()).not.toBeInTheDocument();
      });
    });

    describe('Data requests', () => {
      it('Enriches data requests', async () => {
        await clickBasicInput();
        await clickApplicationsExpand();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothPictureFactory')
          );
        });

        await clickBasicInput();
        await clickApplicationsSlothVoteTrackerSelect();
        await clickBasicInput();
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(
              ({ metadata: { name } }) => name === 'slothPictureFactory' || name === 'slothVoteTracker'
            )
          );
        });

        await clickBasicInput();
        await clickApplicationsSlothPictureFactorySelect();
        await clickBasicInput();
        await waitFor(() => {
          const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
          expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
            mocksScopes.filter(({ metadata: { name } }) => name === 'slothVoteTracker')
          );
        });
      });
    });
  });
});
