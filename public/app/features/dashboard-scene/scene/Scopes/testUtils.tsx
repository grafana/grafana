import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import {
  AdHocFiltersVariable,
  behaviors,
  GroupByVariable,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { DashboardControls } from 'app/features/dashboard-scene/scene//DashboardControls';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import * as api from './api';

export const mocksScopes: Scope[] = [
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
    metadata: { name: 'slothClusterEast' },
    spec: {
      title: 'slothClusterEast',
      type: 'cluster',
      description: 'slothClusterEast',
      category: 'clusters',
      filters: [{ key: 'cluster', value: 'slothClusterEast', operator: 'equals' }],
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

export const mocksScopeDashboardBindings: ScopeDashboardBinding[] = [
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
  {
    metadata: { name: 'binding5' },
    spec: { dashboard: '5', dashboardTitle: 'My Dashboard 5', scope: 'slothClusterNorth' },
  },
  {
    metadata: { name: 'binding6' },
    spec: { dashboard: '6', dashboardTitle: 'My Dashboard 6', scope: 'slothClusterNorth' },
  },
  {
    metadata: { name: 'binding7' },
    spec: { dashboard: '7', dashboardTitle: 'My Dashboard 7', scope: 'slothClusterNorth' },
  },
  {
    metadata: { name: 'binding8' },
    spec: { dashboard: '5', dashboardTitle: 'My Dashboard 5', scope: 'slothClusterSouth' },
  },
  {
    metadata: { name: 'binding9' },
    spec: { dashboard: '6', dashboardTitle: 'My Dashboard 6', scope: 'slothClusterSouth' },
  },
  {
    metadata: { name: 'binding10' },
    spec: { dashboard: '8', dashboardTitle: 'My Dashboard 8', scope: 'slothClusterSouth' },
  },
] as const;

export const mocksNodes: Array<ScopeNode & { parent: string }> = [
  {
    parent: '',
    metadata: { name: 'applications' },
    spec: {
      nodeType: 'container',
      title: 'Applications',
      description: 'Application Scopes',
    },
  },
  {
    parent: '',
    metadata: { name: 'clusters' },
    spec: {
      nodeType: 'container',
      title: 'Clusters',
      description: 'Cluster Scopes',
      disableMultiSelect: true,
      linkType: 'scope',
      linkId: 'indexHelperCluster',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-slothPictureFactory' },
    spec: {
      nodeType: 'leaf',
      title: 'slothPictureFactory',
      description: 'slothPictureFactory',
      linkType: 'scope',
      linkId: 'slothPictureFactory',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-slothVoteTracker' },
    spec: {
      nodeType: 'leaf',
      title: 'slothVoteTracker',
      description: 'slothVoteTracker',
      linkType: 'scope',
      linkId: 'slothVoteTracker',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-clusters' },
    spec: {
      nodeType: 'container',
      title: 'Clusters',
      description: 'Application/Clusters Scopes',
      linkType: 'scope',
      linkId: 'indexHelperCluster',
    },
  },
  {
    parent: 'applications-clusters',
    metadata: { name: 'applications-clusters-slothClusterNorth' },
    spec: {
      nodeType: 'leaf',
      title: 'slothClusterNorth',
      description: 'slothClusterNorth',
      linkType: 'scope',
      linkId: 'slothClusterNorth',
    },
  },
  {
    parent: 'applications-clusters',
    metadata: { name: 'applications-clusters-slothClusterSouth' },
    spec: {
      nodeType: 'leaf',
      title: 'slothClusterSouth',
      description: 'slothClusterSouth',
      linkType: 'scope',
      linkId: 'slothClusterSouth',
    },
  },
  {
    parent: 'clusters',
    metadata: { name: 'clusters-slothClusterNorth' },
    spec: {
      nodeType: 'leaf',
      title: 'slothClusterNorth',
      description: 'slothClusterNorth',
      linkType: 'scope',
      linkId: 'slothClusterNorth',
    },
  },
  {
    parent: 'clusters',
    metadata: { name: 'clusters-slothClusterSouth' },
    spec: {
      nodeType: 'leaf',
      title: 'slothClusterSouth',
      description: 'slothClusterSouth',
      linkType: 'scope',
      linkId: 'slothClusterSouth',
    },
  },
  {
    parent: 'clusters',
    metadata: { name: 'clusters-slothClusterEast' },
    spec: {
      nodeType: 'leaf',
      title: 'slothClusterEast',
      description: 'slothClusterEast',
      linkType: 'scope',
      linkId: 'slothClusterEast',
    },
  },
  {
    parent: 'clusters',
    metadata: { name: 'clusters-applications' },
    spec: {
      nodeType: 'container',
      title: 'Applications',
      description: 'Clusters/Application Scopes',
    },
  },
  {
    parent: 'clusters-applications',
    metadata: { name: 'clusters-applications-slothPictureFactory' },
    spec: {
      nodeType: 'leaf',
      title: 'slothPictureFactory',
      description: 'slothPictureFactory',
      linkType: 'scope',
      linkId: 'slothPictureFactory',
    },
  },
  {
    parent: 'clusters-applications',
    metadata: { name: 'clusters-applications-slothVoteTracker' },
    spec: {
      nodeType: 'leaf',
      title: 'slothVoteTracker',
      description: 'slothVoteTracker',
      linkType: 'scope',
      linkId: 'slothVoteTracker',
    },
  },
] as const;

export const fetchNodesSpy = jest.spyOn(api, 'fetchNodes');
export const fetchScopeSpy = jest.spyOn(api, 'fetchScope');
export const fetchSelectedScopesSpy = jest.spyOn(api, 'fetchSelectedScopes');
export const fetchSuggestedDashboardsSpy = jest.spyOn(api, 'fetchSuggestedDashboards');

export const getMock = jest
  .fn()
  .mockImplementation((url: string, params: { parent: string; scope: string[]; query?: string }) => {
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

    if (url.startsWith('/api/dashboards/uid/')) {
      return {};
    }

    if (url.startsWith('/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/')) {
      return {
        metadata: {
          name: '1',
        },
      };
    }

    return {};
  });

const selectors = {
  tree: {
    search: 'scopes-tree-search',
    headline: 'scopes-tree-headline',
    select: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-checkbox`,
    radio: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-radio`,
    expand: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-expand`,
    title: (nodeId: string, type: 'result' | 'persisted') => `scopes-tree-${type}-${nodeId}-title`,
  },
  filters: {
    input: 'scopes-filters-input',
    container: 'scopes-filters-container',
    loading: 'scopes-filters-loading',
    apply: 'scopes-filters-apply',
    cancel: 'scopes-filters-cancel',
  },
  dashboards: {
    expand: 'scopes-dashboards-expand',
    container: 'scopes-dashboards-container',
    search: 'scopes-dashboards-search',
    loading: 'scopes-dashboards-loading',
    dashboard: (uid: string) => `scopes-dashboards-${uid}`,
    notFoundNoScopes: 'scopes-dashboards-notFoundNoScopes',
    notFoundForScope: 'scopes-dashboards-notFoundForScope',
    notFoundForFilter: 'scopes-dashboards-notFoundForFilter',
    notFoundForFilterClear: 'scopes-dashboards-notFoundForFilter-clear',
  },
};

export const getFiltersInput = () => screen.getByTestId<HTMLInputElement>(selectors.filters.input);
export const queryFiltersApply = () => screen.queryByTestId(selectors.filters.apply);
export const getFiltersApply = () => screen.getByTestId(selectors.filters.apply);
export const getFiltersCancel = () => screen.getByTestId(selectors.filters.cancel);

export const queryDashboardsExpand = () => screen.queryByTestId(selectors.dashboards.expand);
export const getDashboardsExpand = () => screen.getByTestId(selectors.dashboards.expand);
export const queryDashboardsContainer = () => screen.queryByTestId(selectors.dashboards.container);
export const getDashboardsContainer = () => screen.getByTestId(selectors.dashboards.container);
export const queryDashboardsSearch = () => screen.queryByTestId(selectors.dashboards.search);
export const getDashboardsSearch = () => screen.getByTestId<HTMLInputElement>(selectors.dashboards.search);
export const queryAllDashboard = (uid: string) => screen.queryAllByTestId(selectors.dashboards.dashboard(uid));
export const queryDashboard = (uid: string) => screen.queryByTestId(selectors.dashboards.dashboard(uid));
export const getDashboard = (uid: string) => screen.getByTestId(selectors.dashboards.dashboard(uid));
export const getNotFoundNoScopes = () => screen.getByTestId(selectors.dashboards.notFoundNoScopes);
export const getNotFoundForScope = () => screen.getByTestId(selectors.dashboards.notFoundForScope);
export const getNotFoundForFilter = () => screen.getByTestId(selectors.dashboards.notFoundForFilter);
export const getNotFoundForFilterClear = () => screen.getByTestId(selectors.dashboards.notFoundForFilterClear);

export const getTreeSearch = () => screen.getByTestId<HTMLInputElement>(selectors.tree.search);
export const getTreeHeadline = () => screen.getByTestId(selectors.tree.headline);
export const getResultApplicationsExpand = () => screen.getByTestId(selectors.tree.expand('applications', 'result'));
export const queryResultApplicationsSlothPictureFactoryTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-slothPictureFactory', 'result'));
export const getResultApplicationsSlothPictureFactoryTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-slothPictureFactory', 'result'));
export const getResultApplicationsSlothPictureFactorySelect = () =>
  screen.getByTestId(selectors.tree.select('applications-slothPictureFactory', 'result'));
export const queryPersistedApplicationsSlothPictureFactoryTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-slothPictureFactory', 'persisted'));
export const getPersistedApplicationsSlothPictureFactoryTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-slothPictureFactory', 'persisted'));
export const getPersistedApplicationsSlothPictureFactorySelect = () =>
  screen.getByTestId(selectors.tree.select('applications-slothPictureFactory', 'persisted'));
export const queryResultApplicationsSlothVoteTrackerTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-slothVoteTracker', 'result'));
export const getResultApplicationsSlothVoteTrackerTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-slothVoteTracker', 'result'));
export const getResultApplicationsSlothVoteTrackerSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-slothVoteTracker', 'result'));
export const queryPersistedApplicationsSlothVoteTrackerTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-slothVoteTracker', 'persisted'));
export const getPersistedApplicationsSlothVoteTrackerTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-slothVoteTracker', 'persisted'));
export const queryResultApplicationsClustersTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-clusters', 'result'));
export const getResultApplicationsClustersSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-clusters', 'result'));
export const getResultApplicationsClustersExpand = () =>
  screen.getByTestId(selectors.tree.expand('applications-clusters', 'result'));
export const getResultApplicationsClustersSlothClusterNorthSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-clusters-slothClusterNorth', 'result'));
export const getResultApplicationsClustersSlothClusterSouthSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-clusters-slothClusterSouth', 'result'));

export const getResultClustersSelect = () => screen.getByTestId(selectors.tree.select('clusters', 'result'));
export const getResultClustersExpand = () => screen.getByTestId(selectors.tree.expand('clusters', 'result'));
export const getResultClustersSlothClusterNorthRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('clusters-slothClusterNorth', 'result'));
export const getResultClustersSlothClusterSouthRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('clusters-slothClusterSouth', 'result'));
export const getResultClustersSlothClusterEastRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('clusters-slothClusterEast', 'result'));

export function buildTestScene(overrides: Partial<DashboardScene> = {}) {
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
    $variables: new SceneVariableSet({
      variables: [
        new AdHocFiltersVariable({
          name: 'adhoc',
          datasource: { uid: 'my-ds-uid' },
        }),
        new GroupByVariable({
          name: 'groupby',
          datasource: { uid: 'my-ds-uid' },
        }),
      ],
    }),
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

export function renderDashboard(dashboardScene: DashboardScene) {
  return render(<dashboardScene.Component model={dashboardScene} />);
}
