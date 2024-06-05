import { screen } from '@testing-library/react';
import userEvents from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/test-utils';

import { Scope, ScopeDashboardBinding, ScopeTreeItemSpec } from '@grafana/data';
import { behaviors, SceneGridItem, SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DashboardControls } from 'app/features/dashboard-scene/scene//DashboardControls';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import * as dashboardsApi from './api/dashboards';
import * as scopesApi from './api/scopes';

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
] as const;

export const mocksNodes: Array<ScopeTreeItemSpec & { parent: string }> = [
  {
    parent: '',
    nodeId: 'applications',
    nodeType: 'container',
    title: 'Applications',
    description: 'Application Scopes',
  },
  {
    parent: '',
    nodeId: 'clusters',
    nodeType: 'container',
    title: 'Clusters',
    description: 'Cluster Scopes',
    linkType: 'scope',
    linkId: 'indexHelperCluster',
  },
  {
    parent: 'applications',
    nodeId: 'applications-slothPictureFactory',
    nodeType: 'leaf',
    title: 'slothPictureFactory',
    description: 'slothPictureFactory',
    linkType: 'scope',
    linkId: 'slothPictureFactory',
  },
  {
    parent: 'applications',
    nodeId: 'applications-slothVoteTracker',
    nodeType: 'leaf',
    title: 'slothVoteTracker',
    description: 'slothVoteTracker',
    linkType: 'scope',
    linkId: 'slothVoteTracker',
  },
  {
    parent: 'applications',
    nodeId: 'applications.clusters',
    nodeType: 'container',
    title: 'Clusters',
    description: 'Application/Clusters Scopes',
    linkType: 'scope',
    linkId: 'indexHelperCluster',
  },
  {
    parent: 'applications.clusters',
    nodeId: 'applications.clusters-slothClusterNorth',
    nodeType: 'leaf',
    title: 'slothClusterNorth',
    description: 'slothClusterNorth',
    linkType: 'scope',
    linkId: 'slothClusterNorth',
  },
  {
    parent: 'applications.clusters',
    nodeId: 'applications.clusters-slothClusterSouth',
    nodeType: 'leaf',
    title: 'slothClusterSouth',
    description: 'slothClusterSouth',
    linkType: 'scope',
    linkId: 'slothClusterSouth',
  },
  {
    parent: 'clusters',
    nodeId: 'clusters-slothClusterNorth',
    nodeType: 'leaf',
    title: 'slothClusterNorth',
    description: 'slothClusterNorth',
    linkType: 'scope',
    linkId: 'slothClusterNorth',
  },
  {
    parent: 'clusters',
    nodeId: 'clusters-slothClusterSouth',
    nodeType: 'leaf',
    title: 'slothClusterSouth',
    description: 'slothClusterSouth',
    linkType: 'scope',
    linkId: 'slothClusterSouth',
  },
  {
    parent: 'clusters',
    nodeId: 'clusters.applications',
    nodeType: 'container',
    title: 'Applications',
    description: 'Clusters/Application Scopes',
  },
  {
    parent: 'clusters.applications',
    nodeId: 'clusters.applications-slothPictureFactory',
    nodeType: 'leaf',
    title: 'slothPictureFactory',
    description: 'slothPictureFactory',
    linkType: 'scope',
    linkId: 'slothPictureFactory',
  },
  {
    parent: 'clusters.applications',
    nodeId: 'clusters.applications-slothVoteTracker',
    nodeType: 'leaf',
    title: 'slothVoteTracker',
    description: 'slothVoteTracker',
    linkType: 'scope',
    linkId: 'slothVoteTracker',
  },
] as const;

export const fetchNodesSpy = jest.spyOn(scopesApi, 'fetchNodes');
export const fetchScopeSpy = jest.spyOn(scopesApi, 'fetchScope');
export const fetchScopesSpy = jest.spyOn(scopesApi, 'fetchScopes');
export const fetchDashboardsSpy = jest.spyOn(dashboardsApi, 'fetchDashboards');

export const scopesNamesPaths = [
  ['', 'applications'],
  ['', 'applications'],
  ['', 'applications', 'applications.clusters'],
  ['', 'applications', 'applications.clusters'],
];
export const scopesNames = ['slothPictureFactory', 'slothVoteTracker', 'slothClusterNorth', 'slothClusterSouth'];
export const scopes = scopesNames.map((scopeName) => mocksScopes.find((scope) => scope.metadata.name === scopeName)!);

const selectors = {
  root: {
    expand: 'scopes-root-expand',
  },
  tree: {
    search: (nodeId: string) => `scopes-tree-${nodeId}-search`,
    select: (nodeId: string) => `scopes-tree-${nodeId}-checkbox`,
    expand: (nodeId: string) => `scopes-tree-${nodeId}-expand`,
    title: (nodeId: string) => `scopes-tree-${nodeId}-title`,
  },
  basicSelector: {
    container: 'scopes-basic-container',
    innerContainer: 'scopes-basic-inner-container',
    loading: 'scopes-basic-loading',
    openAdvanced: 'scopes-basic-open-advanced',
    input: 'scopes-basic-input',
  },
  advancedSelector: {
    container: 'scopes-advanced-container',
    loading: 'scopes-advanced-loading',
    apply: 'scopes-advanced-apply',
    cancel: 'scopes-advanced-cancel',
  },
  dashboards: {
    container: 'scopes-dashboards-container',
    search: 'scopes-dashboards-search',
    loading: 'scopes-dashboards-loading',
    dashboard: (uid: string) => `scopes-dashboards-${uid}`,
  },
};

export const queryBasicInnerContainer = () => screen.queryByTestId(selectors.basicSelector.innerContainer);
export const queryAdvancedApply = () => screen.queryByTestId(selectors.advancedSelector.apply);
export const queryDashboard = (uid: string) => screen.queryByTestId(selectors.dashboards.dashboard(uid));
export const getRootExpand = () => screen.getByTestId(selectors.root.expand);
export const getBasicInput = () => screen.getByTestId<HTMLInputElement>(selectors.basicSelector.input);
export const getBasicInnerContainer = () => screen.getByTestId(selectors.basicSelector.innerContainer);
export const getBasicOpenAdvanced = () => screen.getByTestId(selectors.basicSelector.openAdvanced);
export const getAdvancedApply = () => screen.getByTestId(selectors.advancedSelector.apply);
export const getAdvancedCancel = () => screen.getByTestId(selectors.advancedSelector.cancel);
export const getApplicationsExpand = () => screen.getByTestId(selectors.tree.expand('applications'));
export const getApplicationsSlothPictureFactoryTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-slothPictureFactory'));
export const getApplicationsSlothPictureFactorySelect = () =>
  screen.getByTestId(selectors.tree.select('applications-slothPictureFactory'));
export const getApplicationsSlothVoteTrackerSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-slothVoteTracker'));
export const getApplicationsClustersExpand = () => screen.getByTestId(selectors.tree.expand('applications'));
export const getClustersSelect = () => screen.getByTestId(selectors.tree.select('clusters'));
export const getDashboardsContainer = () => screen.getByTestId(selectors.dashboards.container);
export const getDashboard = (uid: string) => screen.getByTestId(selectors.dashboards.dashboard(uid));
export const clickRootExpand = () => userEvents.click(getRootExpand());
export const clickBasicInput = () => userEvents.click(getBasicInput());
export const clickBasicOpenAdvanced = () => userEvents.click(getBasicOpenAdvanced());
export const clickAdvancedApply = () => userEvents.click(getAdvancedApply());
export const clickAdvancedCancel = () => userEvents.click(getAdvancedCancel());
export const clickApplicationsExpand = () => userEvents.click(getApplicationsExpand());
export const clickApplicationsSlothPictureFactorySelect = () =>
  userEvents.click(getApplicationsSlothPictureFactorySelect());
export const clickApplicationsSlothVoteTrackerSelect = () => userEvents.click(getApplicationsSlothVoteTrackerSelect());
export const clickApplicationsClustersExpand = () => userEvents.click(getApplicationsClustersExpand());
export const clickClustersSelect = () => userEvents.click(getClustersSelect());

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
