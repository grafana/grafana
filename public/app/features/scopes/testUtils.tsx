import { screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { render } from 'test/test-utils';

import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import {
  AdHocFiltersVariable,
  behaviors,
  GroupByVariable,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { DashboardControls } from 'app/features/dashboard-scene/scene//DashboardControls';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesFacade } from './ScopesFacadeScene';
import { scopesDashboardsScene, scopesSelectorScene } from './instance';
import { getInitialDashboardsState } from './internal/ScopesDashboardsScene';
import { initialSelectorState } from './internal/ScopesSelectorScene';
import * as api from './internal/api';
import { DASHBOARDS_OPENED_KEY } from './internal/const';

export const mocksScopes: Scope[] = [
  {
    metadata: { name: 'cloud' },
    spec: {
      title: 'Cloud',
      type: 'indexHelper',
      description: 'redundant label filter but makes queries faster',
      category: 'indexHelpers',
      filters: [{ key: 'cloud', value: '.*', operator: 'regex-match' }],
    },
  },
  {
    metadata: { name: 'dev' },
    spec: {
      title: 'Dev',
      type: 'cloud',
      description: 'Dev',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'dev', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'ops' },
    spec: {
      title: 'Ops',
      type: 'cloud',
      description: 'Ops',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'ops', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'prod' },
    spec: {
      title: 'Prod',
      type: 'cloud',
      description: 'Prod',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'prod', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'grafana' },
    spec: {
      title: 'Grafana',
      type: 'app',
      description: 'Grafana',
      category: 'apps',
      filters: [{ key: 'app', value: 'grafana', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'mimir' },
    spec: {
      title: 'Mimir',
      type: 'app',
      description: 'Mimir',
      category: 'apps',
      filters: [{ key: 'app', value: 'mimir', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'loki' },
    spec: {
      title: 'Loki',
      type: 'app',
      description: 'Loki',
      category: 'apps',
      filters: [{ key: 'app', value: 'loki', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'tempo' },
    spec: {
      title: 'Tempo',
      type: 'app',
      description: 'Tempo',
      category: 'apps',
      filters: [{ key: 'app', value: 'tempo', operator: 'equals' }],
    },
  },
] as const;

const dashboardBindingsGenerator = (
  scopes: string[],
  dashboards: Array<{ dashboardTitle: string; dashboardKey?: string; groups?: string[] }>
) =>
  scopes.reduce<ScopeDashboardBinding[]>((scopeAcc, scopeTitle) => {
    const scope = scopeTitle.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');

    return [
      ...scopeAcc,
      ...dashboards.reduce<ScopeDashboardBinding[]>((acc, { dashboardTitle, groups, dashboardKey }, idx) => {
        dashboardKey = dashboardKey ?? dashboardTitle.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');
        const group = !groups
          ? ''
          : groups.length === 1
            ? groups[0] === ''
              ? ''
              : `${groups[0].toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}-`
            : `multiple${idx}-`;
        const dashboard = `${group}${dashboardKey}`;

        return [
          ...acc,
          {
            metadata: { name: `${scope}-${dashboard}` },
            spec: {
              dashboard,
              dashboardTitle,
              scope,
              groups,
            },
          },
        ];
      }, []),
    ];
  }, []);

export const mocksScopeDashboardBindings: ScopeDashboardBinding[] = [
  ...dashboardBindingsGenerator(
    ['Grafana'],
    [
      { dashboardTitle: 'Data Sources', groups: ['General'] },
      { dashboardTitle: 'Usage', groups: ['General'] },
      { dashboardTitle: 'Frontend Errors', groups: ['Observability'] },
      { dashboardTitle: 'Frontend Logs', groups: ['Observability'] },
      { dashboardTitle: 'Backend Errors', groups: ['Observability'] },
      { dashboardTitle: 'Backend Logs', groups: ['Observability'] },
      { dashboardTitle: 'Usage Overview', groups: ['Usage'] },
      { dashboardTitle: 'Data Sources', groups: ['Usage'] },
      { dashboardTitle: 'Stats', groups: ['Usage'] },
      { dashboardTitle: 'Overview', groups: [''] },
      { dashboardTitle: 'Frontend' },
      { dashboardTitle: 'Stats' },
    ]
  ),
  ...dashboardBindingsGenerator(
    ['Loki', 'Tempo', 'Mimir'],
    [
      { dashboardTitle: 'Ingester', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Distributor', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Compacter', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Datasource Errors', groups: ['Observability', 'Investigations'] },
      { dashboardTitle: 'Datasource Logs', groups: ['Observability', 'Investigations'] },
      { dashboardTitle: 'Overview' },
      { dashboardTitle: 'Stats', dashboardKey: 'another-stats' },
    ]
  ),
  ...dashboardBindingsGenerator(
    ['Dev', 'Ops', 'Prod'],
    [
      { dashboardTitle: 'Overview', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Metrics', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Labels', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Overview', groups: ['Usage Insights'] },
      { dashboardTitle: 'Data Sources', groups: ['Usage Insights'] },
      { dashboardTitle: 'Query Errors', groups: ['Usage Insights'] },
      { dashboardTitle: 'Alertmanager', groups: ['Usage Insights'] },
      { dashboardTitle: 'Metrics Ingestion', groups: ['Usage Insights'] },
      { dashboardTitle: 'Billing/Usage' },
    ]
  ),
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
    metadata: { name: 'cloud' },
    spec: {
      nodeType: 'container',
      title: 'Cloud',
      description: 'Cloud Scopes',
      disableMultiSelect: true,
      linkType: 'scope',
      linkId: 'cloud',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-grafana' },
    spec: {
      nodeType: 'leaf',
      title: 'Grafana',
      description: 'Grafana',
      linkType: 'scope',
      linkId: 'grafana',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-mimir' },
    spec: {
      nodeType: 'leaf',
      title: 'Mimir',
      description: 'Mimir',
      linkType: 'scope',
      linkId: 'mimir',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-loki' },
    spec: {
      nodeType: 'leaf',
      title: 'Loki',
      description: 'Loki',
      linkType: 'scope',
      linkId: 'loki',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-tempo' },
    spec: {
      nodeType: 'leaf',
      title: 'Tempo',
      description: 'Tempo',
      linkType: 'scope',
      linkId: 'tempo',
    },
  },
  {
    parent: 'applications',
    metadata: { name: 'applications-cloud' },
    spec: {
      nodeType: 'container',
      title: 'Cloud',
      description: 'Application/Cloud Scopes',
      linkType: 'scope',
      linkId: 'cloud',
    },
  },
  {
    parent: 'applications-cloud',
    metadata: { name: 'applications-cloud-dev' },
    spec: {
      nodeType: 'leaf',
      title: 'Dev',
      description: 'Dev',
      linkType: 'scope',
      linkId: 'dev',
    },
  },
  {
    parent: 'applications-cloud',
    metadata: { name: 'applications-cloud-ops' },
    spec: {
      nodeType: 'leaf',
      title: 'Ops',
      description: 'Ops',
      linkType: 'scope',
      linkId: 'ops',
    },
  },
  {
    parent: 'applications-cloud',
    metadata: { name: 'applications-cloud-prod' },
    spec: {
      nodeType: 'leaf',
      title: 'Prod',
      description: 'Prod',
      linkType: 'scope',
      linkId: 'prod',
    },
  },
  {
    parent: 'cloud',
    metadata: { name: 'cloud-dev' },
    spec: {
      nodeType: 'leaf',
      title: 'Dev',
      description: 'Dev',
      linkType: 'scope',
      linkId: 'dev',
    },
  },
  {
    parent: 'cloud',
    metadata: { name: 'cloud-ops' },
    spec: {
      nodeType: 'leaf',
      title: 'Ops',
      description: 'Ops',
      linkType: 'scope',
      linkId: 'ops',
    },
  },
  {
    parent: 'cloud',
    metadata: { name: 'cloud-prod' },
    spec: {
      nodeType: 'leaf',
      title: 'Prod',
      description: 'Prod',
      linkType: 'scope',
      linkId: 'prod',
    },
  },
  {
    parent: 'cloud',
    metadata: { name: 'cloud-applications' },
    spec: {
      nodeType: 'container',
      title: 'Applications',
      description: 'Cloud/Application Scopes',
    },
  },
  {
    parent: 'cloud-applications',
    metadata: { name: 'cloud-applications-grafana' },
    spec: {
      nodeType: 'leaf',
      title: 'Grafana',
      description: 'Grafana',
      linkType: 'scope',
      linkId: 'grafana',
    },
  },
  {
    parent: 'cloud-applications',
    metadata: { name: 'cloud-applications-mimir' },
    spec: {
      nodeType: 'leaf',
      title: 'Mimir',
      description: 'Mimir',
      linkType: 'scope',
      linkId: 'mimir',
    },
  },
  {
    parent: 'cloud-applications',
    metadata: { name: 'cloud-applications-loki' },
    spec: {
      nodeType: 'leaf',
      title: 'Loki',
      description: 'Loki',
      linkType: 'scope',
      linkId: 'loki',
    },
  },
  {
    parent: 'cloud-applications',
    metadata: { name: 'cloud-applications-tempo' },
    spec: {
      nodeType: 'leaf',
      title: 'Tempo',
      description: 'Tempo',
      linkType: 'scope',
      linkId: 'tempo',
    },
  },
] as const;

export const fetchNodesSpy = jest.spyOn(api, 'fetchNodes');
export const fetchScopeSpy = jest.spyOn(api, 'fetchScope');
export const fetchSelectedScopesSpy = jest.spyOn(api, 'fetchSelectedScopes');
export const fetchDashboardsSpy = jest.spyOn(api, 'fetchDashboards');

export const getMock = jest
  .fn()
  .mockImplementation((url: string, params: { parent: string; scope: string[]; query?: string }) => {
    if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_node_children')) {
      return {
        items: mocksNodes.filter(
          ({ parent, spec: { title } }) =>
            parent === params.parent && title.toLowerCase().includes((params.query ?? '').toLowerCase())
        ),
      };
    }

    if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
      const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

      return mocksScopes.find((scope) => scope.metadata.name.toLowerCase() === name.toLowerCase()) ?? {};
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
  selector: {
    input: 'scopes-selector-input',
    container: 'scopes-selector-container',
    loading: 'scopes-selector-loading',
    apply: 'scopes-selector-apply',
    cancel: 'scopes-selector-cancel',
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

export const getSelectorInput = () => screen.getByTestId<HTMLInputElement>(selectors.selector.input);
export const querySelectorApply = () => screen.queryByTestId(selectors.selector.apply);
export const getSelectorApply = () => screen.getByTestId(selectors.selector.apply);
export const getSelectorCancel = () => screen.getByTestId(selectors.selector.cancel);

export const getDashboardsExpand = () => screen.getByTestId(selectors.dashboards.expand);
export const queryDashboardsContainer = () => screen.queryByTestId(selectors.dashboards.container);
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
export const queryResultApplicationsGrafanaTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-grafana', 'result'));
export const getResultApplicationsGrafanaTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-grafana', 'result'));
export const getResultApplicationsGrafanaSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-grafana', 'result'));
export const queryPersistedApplicationsGrafanaTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-grafana', 'persisted'));
export const queryResultApplicationsMimirTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-mimir', 'result'));
export const getResultApplicationsMimirTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-mimir', 'result'));
export const getResultApplicationsMimirSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-mimir', 'result'));
export const queryPersistedApplicationsMimirTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-mimir', 'persisted'));
export const getPersistedApplicationsMimirTitle = () =>
  screen.getByTestId(selectors.tree.title('applications-mimir', 'persisted'));
export const getPersistedApplicationsMimirSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-mimir', 'persisted'));
export const queryResultApplicationsCloudTitle = () =>
  screen.queryByTestId(selectors.tree.title('applications-cloud', 'result'));
export const getResultApplicationsCloudSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-cloud', 'result'));
export const getResultApplicationsCloudExpand = () =>
  screen.getByTestId(selectors.tree.expand('applications-cloud', 'result'));
export const getResultApplicationsCloudDevSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-cloud-dev', 'result'));
export const getResultApplicationsCloudOpsSelect = () =>
  screen.getByTestId(selectors.tree.select('applications-cloud-ops', 'result'));

export const getResultCloudSelect = () => screen.getByTestId(selectors.tree.select('cloud', 'result'));
export const getResultCloudExpand = () => screen.getByTestId(selectors.tree.expand('cloud', 'result'));
export const getResultCloudDevRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('cloud-dev', 'result'));
export const getResultCloudOpsRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('cloud-ops', 'result'));
export const getResultCloudProdRadio = () =>
  screen.getByTestId<HTMLInputElement>(selectors.tree.radio('cloud-prod', 'result'));

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
    $behaviors: [
      new behaviors.CursorSync({}),
      new ScopesFacade({
        handler: (facade) => sceneGraph.getTimeRange(facade).onRefresh(),
      }),
    ],
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
  return render(
    <KBarProvider>
      <AppChrome>
        <dashboardScene.Component model={dashboardScene} />
      </AppChrome>
    </KBarProvider>
  );
}

export function resetScenes() {
  scopesSelectorScene?.setState(initialSelectorState);

  localStorage.removeItem(DASHBOARDS_OPENED_KEY);

  scopesDashboardsScene?.setState(getInitialDashboardsState());
}
