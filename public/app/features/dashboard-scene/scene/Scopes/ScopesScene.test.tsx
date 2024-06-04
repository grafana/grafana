import { waitFor } from '@testing-library/react';

import { Scope, ScopeDashboardBinding, ScopeTreeItemSpec } from '@grafana/data';
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

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';
import * as scopesApi from './api/scopes';

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

const mocksScopeDashboardBindings: ScopeDashboardBinding[] = [
  {
    metadata: { name: 'binding1' },
    spec: { dashboard: '1', dashboardTitle: 'My Dashboard 1', scope: 'slothPictureFactory' },
  },
  {
    metadata: { name: 'binding2' },
    spec: { dashboard: '2', dashboardTitle: 'My Dashboard 2', scope: 'slothPictureFactory' },
  },
  {
    metadata: { name: 'binding3' },
    spec: { dashboard: '3', dashboardTitle: 'My Dashboard 3', scope: 'slothVoteTracker' },
  },
  {
    metadata: { name: 'binding4' },
    spec: { dashboard: '4', dashboardTitle: 'My Dashboard 4', scope: 'slothVoteTracker' },
  },
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

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string) => {
      const search = new URLSearchParams(url.split('?').pop() || '');

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find')) {
        const parent = search.get('parent')?.replace('parent=', '');

        return {
          items: mocksNodes.filter((node) => (parent ? node.nodeId.startsWith(parent) : !node.nodeId.includes('.'))),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

        return mocksScopes.find((scope) => scope.metadata.name === name) ?? {};
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopedashboardbindings')) {
        const scope = search.get('fieldSelector')?.replace('spec.scope=', '') ?? '';

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
      const scopesScene = dashboardScene.state.scopes;

      expect(scopesScene).toBeUndefined();
    });
  });

  describe('Feature flag on', () => {
    let scopesNamesPaths: string[][];
    let scopesNames: string[];
    let scopes: Scope[];
    let scopeDashboardBindings: ScopeDashboardBinding[][];
    let dashboardScene: DashboardScene;
    let scopesScene: ScopesScene;
    let filtersScene: ScopesFiltersScene;
    let dashboardsScene: ScopesDashboardsScene;
    let fetchNodesSpy: jest.SpyInstance;
    let fetchScopesSpy: jest.SpyInstance;
    let fetchDashboardsSpy: jest.SpyInstance;

    beforeAll(() => {
      config.featureToggles.scopeFilters = true;
    });

    beforeEach(() => {
      scopesNamesPaths = [
        ['', 'applications'],
        ['', 'applications'],
        ['', 'applications', 'applications.clusters'],
        ['', 'applications', 'applications.clusters'],
      ];
      scopesNames = ['slothPictureFactory', 'slothVoteTracker', 'slothClusterNorth', 'slothClusterSouth'];
      scopes = scopesNames.map((scopeName) => mocksScopes.find((scope) => scope.metadata.name === scopeName)!);
      scopeDashboardBindings = scopesNames.map(
        (scopeName) =>
          mocksScopeDashboardBindings.filter(({ spec: { scope: bindingScope } }) => bindingScope === scopeName)!
      );
      dashboardScene = buildTestScene();
      scopesScene = dashboardScene.state.scopes!;
      filtersScene = scopesScene.state.filters;
      dashboardsScene = scopesScene.state.dashboards;
      fetchNodesSpy = jest.spyOn(scopesApi, 'fetchNodes');
      fetchScopesSpy = jest.spyOn(scopesApi, 'fetchScope');
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
      expect(fetchNodesSpy).toHaveBeenCalled();
    });

    it('Fetches dashboards list', () => {
      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(scopeDashboardBindings[0]);
      });

      filtersScene.updateScopes([scopesNames[1]]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(scopeDashboardBindings.flat());
      });

      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(scopeDashboardBindings[1]);
      });
    });

    it('Enriches data requests', () => {
      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[0])
        );
      });

      filtersScene.updateScopes([scopesNames[1]]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(scopes);
      });

      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;
        expect(dashboardScene.enrichDataRequest(queryRunner).scopes).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[1])
        );
      });
    });

    it('Fetches sub-nodes on expand', () => {
      filtersScene.updateNode(scopesNamesPaths[0], true, '');
      expect(fetchNodesSpy).toHaveBeenCalled();
    });

    it('Fetches scope details on select', () => {
      filtersScene.updateNode(scopesNamesPaths[0], true, '');
      filtersScene.toggleNodeSelect(scopesNamesPaths[0]);
      expect(fetchScopesSpy).toHaveBeenCalled();
    });

    it('Fetches scope details on save', () => {
      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.getSelectedScopes()).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[0])
        );
      });

      filtersScene.updateScopes([scopesNames[1]]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.getSelectedScopes()).toEqual(scopes);
      });

      filtersScene.updateScopes([scopesNames[0]]);
      waitFor(() => {
        expect(fetchScopesSpy).toHaveBeenCalled();
        expect(filtersScene.getSelectedScopes()).toEqual(
          scopes.filter((scope) => scope.metadata.name === scopesNames[1])
        );
      });
    });

    it('Toggles expanded state', () => {
      scopesScene.toggleIsExpanded();
      expect(scopesScene.state.isExpanded).toEqual(true);
    });

    describe('View mode', () => {
      it('Enters view mode', () => {
        dashboardScene.onEnterEditMode();
        expect(scopesScene.state.isViewing).toEqual(true);
        expect(scopesScene.state.isExpanded).toEqual(false);
      });

      it('Closes basic selector on enter', () => {
        filtersScene.openBasicSelector();
        dashboardScene.onEnterEditMode();
        expect(filtersScene.state.isBasicOpened).toEqual(false);
      });

      it('Closes advanced selector on enter', () => {
        filtersScene.openAdvancedSelector();
        dashboardScene.onEnterEditMode();
        expect(filtersScene.state.isBasicOpened).toEqual(false);
      });

      it('Exits view mode', () => {
        dashboardScene.onEnterEditMode();
        dashboardScene.exitEditMode({ skipConfirm: true });
        expect(scopesScene.state.isViewing).toEqual(false);
        expect(scopesScene.state.isExpanded).toEqual(false);
      });
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
