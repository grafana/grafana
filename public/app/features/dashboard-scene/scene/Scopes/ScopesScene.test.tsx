import { waitFor } from '@testing-library/react';

import { Scope, ScopeDashboardBindingSpec, ScopeTreeItemSpec } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';
import { DashboardControls } from 'app/features/dashboard-scene/scene//DashboardControls';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopeDashboard, ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';

const mocksScopes: Scope[] = [
  {
    metadata: { name: 'indexHelperCluster' },
    spec: {
      title: 'Cluster Index Helper',
      type: 'indexHelper',
      description: 'redundant label filter but makes queries faster',
      category: 'indexHelpers',
      filters: [{ key: 'indexHelper', value: 'cluster', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'slothClusterNorth' },
    spec: {
      title: 'slothClusterNorth',
      type: 'cluster',
      description: 'slothClusterNorth',
      category: 'clusters',
      filters: [{ key: 'cluster', value: 'slothClusterNorth', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'slothClusterSouth' },
    spec: {
      title: 'slothClusterSouth',
      type: 'cluster',
      description: 'slothClusterSouth',
      category: 'clusters',
      filters: [{ key: 'cluster', value: 'slothClusterSouth', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'slothPictureFactory' },
    spec: {
      title: 'slothPictureFactory',
      type: 'app',
      description: 'slothPictureFactory',
      category: 'apps',
      filters: [{ key: 'app', value: 'slothPictureFactory', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'slothVoteTracker' },
    spec: {
      title: 'slothVoteTracker',
      type: 'app',
      description: 'slothVoteTracker',
      category: 'apps',
      filters: [{ key: 'app', value: 'slothVoteTracker', operator: 'equals' }],
    },
  },
] as const;

const mocksScopeDashboardBindings: ScopeDashboardBindingSpec[] = [
  { dashboard: '1', scope: 'slothPictureFactory' },
  { dashboard: '2', scope: 'slothPictureFactory' },
  { dashboard: '3', scope: 'slothVoteTracker' },
  { dashboard: '4', scope: 'slothVoteTracker' },
] as const;

const mocksNodes: ScopeTreeItemSpec[] = [
  {
    nodeId: 'applications',
    nodeType: 'container',
    title: 'Applications',
    description: 'Application Scopes',
  },
  {
    nodeId: 'clusters',
    nodeType: 'container',
    title: 'Clusters',
    description: 'Cluster Scopes',
    linkType: 'scope',
    linkId: 'indexHelperCluster',
  },
  {
    nodeId: 'applications-slothPictureFactory',
    nodeType: 'leaf',
    title: 'slothPictureFactory',
    description: 'slothPictureFactory',
    linkType: 'scope',
    linkId: 'slothPictureFactory',
  },
  {
    nodeId: 'applications-slothVoteTracker',
    nodeType: 'leaf',
    title: 'slothVoteTracker',
    description: 'slothVoteTracker',
    linkType: 'scope',
    linkId: 'slothVoteTracker',
  },
  {
    nodeId: 'applications.clusters',
    nodeType: 'container',
    title: 'Clusters',
    description: 'Application/Clusters Scopes',
    linkType: 'scope',
    linkId: 'indexHelperCluster',
  },
  {
    nodeId: 'applications.clusters-slothClusterNorth',
    nodeType: 'leaf',
    title: 'slothClusterNorth',
    description: 'slothClusterNorth',
    linkType: 'scope',
    linkId: 'slothClusterNorth',
  },
  {
    nodeId: 'applications.clusters-slothClusterSouth',
    nodeType: 'leaf',
    title: 'slothClusterSouth',
    description: 'slothClusterSouth',
    linkType: 'scope',
    linkId: 'slothClusterSouth',
  },
  {
    nodeId: 'clusters-slothClusterNorth',
    nodeType: 'leaf',
    title: 'slothClusterNorth',
    description: 'slothClusterNorth',
    linkType: 'scope',
    linkId: 'slothClusterNorth',
  },
  {
    nodeId: 'clusters-slothClusterSouth',
    nodeType: 'leaf',
    title: 'slothClusterSouth',
    description: 'slothClusterSouth',
    linkType: 'scope',
    linkId: 'slothClusterSouth',
  },
  {
    nodeId: 'clusters.applications',
    nodeType: 'container',
    title: 'Applications',
    description: 'Clusters/Application Scopes',
  },
  {
    nodeId: 'clusters.applications-slothPictureFactory',
    nodeType: 'leaf',
    title: 'slothPictureFactory',
    description: 'slothPictureFactory',
    linkType: 'scope',
    linkId: 'slothPictureFactory',
  },
  {
    nodeId: 'clusters.applications-slothVoteTracker',
    nodeType: 'leaf',
    title: 'slothVoteTracker',
    description: 'slothVoteTracker',
    linkType: 'scope',
    linkId: 'slothVoteTracker',
  },
] as const;

const getDashboardDetailsForUid = (uid: string) => ({
  dashboard: {
    title: `Dashboard ${uid}`,
    uid,
  },
  meta: {
    url: `/d/dashboard${uid}`,
  },
});
const getDashboardScopeForUid = (uid: string) => ({
  title: `Dashboard ${uid}`,
  uid,
  url: `/d/dashboard${uid}`,
});

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string) => {
      const search = new URLSearchParams(url.split('?').pop() || '');

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find')) {
        const parent = search.get('parent')?.replace('parent=', '');

        return {
          items: mocksNodes.filter((node) => (parent ? node.nodeId.startsWith(parent) : !node.nodeId.includes('-'))),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

        return mocksScopes.find((scope) => scope.metadata.name === name) ?? {};
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopedashboardbindings')) {
        const scope = search.get('fieldSelector')?.replace('spec.scope=', '') ?? '';

        return {
          items: mocksScopeDashboardBindings.filter((binding) => binding.scope === scope),
        };
      }

      if (url.startsWith('/api/dashboards/uid/')) {
        const uid = url.split('/').pop();

        return uid ? getDashboardDetailsForUid(uid) : {};
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
      const scopesScene = dashboardScene.state.scopes;

      expect(scopesScene).toBeUndefined();
    });
  });

  describe('Feature flag on', () => {
    let scopesNames: string[];
    let scopes: Scope[];
    let scopeDashboardBindings: ScopeDashboardBindingSpec[][];
    let dashboards: ScopeDashboard[][];
    let dashboardScene: DashboardScene;
    let scopesScene: ScopesScene;
    let filtersScene: ScopesFiltersScene;
    let dashboardsScene: ScopesDashboardsScene;
    let fetchBaseNodesSpy: jest.SpyInstance;
    let fetchScopesSpy: jest.SpyInstance;
    let fetchDashboardsSpy: jest.SpyInstance;

    beforeAll(() => {
      config.featureToggles.scopeFilters = true;
    });

    beforeEach(() => {
      scopesNames = ['slothClusterNorth', 'slothClusterSouth'];
      scopes = scopesNames.map((scopeName) => mocksScopes.find((scope) => scope.metadata.name === scopeName)!);
      scopeDashboardBindings = scopesNames.map(
        (scopeName) => mocksScopeDashboardBindings.filter((binding) => binding.scope === scopeName)!
      );
      dashboards = scopeDashboardBindings.map((bindings) =>
        bindings.map((binding) => getDashboardScopeForUid(binding.dashboard))
      );
      dashboardScene = buildTestScene();
      scopesScene = dashboardScene.state.scopes!;
      filtersScene = scopesScene.state.filters;
      dashboardsScene = scopesScene.state.dashboards;
      fetchBaseNodesSpy = jest.spyOn(filtersScene!, 'fetchBaseNodes');
      fetchScopesSpy = jest.spyOn(filtersScene!, 'fetchScopes');
      fetchDashboardsSpy = jest.spyOn(dashboardsScene!, 'fetchDashboards');
      dashboardScene.activate();
      scopesScene.activate();
      filtersScene.activate();
      dashboardsScene.activate();
    });

    it('Initializes', () => {
      expect(scopesScene).toBeInstanceOf(ScopesScene);
      expect(filtersScene).toBeInstanceOf(ScopesFiltersScene);
      expect(dashboardsScene).toBeInstanceOf(ScopesDashboardsScene);
    });

    it('Fetches nodes list', () => {
      expect(fetchBaseNodesSpy).toHaveBeenCalled();
    });

    it('Fetches scope details', () => {
      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.state.scopes).toEqual(scopes.filter((scope) => scope.metadata.name === scopesNames[0]));
      });

      filtersScene.toggleScopeSelect(scopesNames[1]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.state.scopes).toEqual(scopes);
      });

      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.state.scopes).toEqual(scopes.filter((scope) => scope.metadata.name === scopesNames[1]));
      });
    });

    it('Fetches dashboards list', () => {
      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(dashboards[0]);
      });

      filtersScene.toggleScopeSelect(scopesNames[1]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(dashboards.flat());
      });

      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(dashboards[1]);
      });
    });

    it('Enriches data requests', () => {
      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[0])
        );
      });

      filtersScene.toggleScopeSelect(scopesNames[1]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
      });

      filtersScene.toggleScopeSelect(scopesNames[0]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[1])
        );
      });
    });

    it('Toggles expanded state', () => {
      scopesScene.toggleIsExpanded();

      expect(scopesScene.state.isExpanded).toEqual(true);
    });

    it('Enters view mode', () => {
      dashboardScene.onEnterEditMode();

      expect(scopesScene.state.isViewing).toEqual(true);
      expect(scopesScene.state.isExpanded).toEqual(false);
    });

    it('Exits view mode', () => {
      dashboardScene.onEnterEditMode();
      dashboardScene.exitEditMode({ skipConfirm: true });

      expect(scopesScene.state.isViewing).toEqual(false);
      expect(scopesScene.state.isExpanded).toEqual(false);
    });
  });
});

function buildTestScene(overrides: Partial<DashboardScene> = {}) {
  return new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
    }),
    controls: new DashboardControls({}),
    $behaviors: [new behaviors.CursorSync({})],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
      ],
    }),
    ...overrides,
  });
}
