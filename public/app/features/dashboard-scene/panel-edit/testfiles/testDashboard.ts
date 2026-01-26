import { Spec as DashboardV2Spec, defaultDataQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

export const panelWithQueriesOnly = {
  datasource: {
    type: 'grafana-testdata-datasource',
    uid: 'gdev-testdata',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 1,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
      },
      refId: 'A',
      scenarioId: 'random_walk',
      seriesCount: 1,
    },
  ],
  title: 'Panel with just queries',
  type: 'timeseries',
};

export const repeatedPanel = {
  datasource: {
    type: 'grafana-testdata-datasource',
    uid: 'gdev-testdata',
  },
  repeat: 'custom',
  repeatDirection: 'h',
  maxPerRow: 4,
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 1,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
      },
      refId: 'A',
      scenarioId: 'random_walk',
      seriesCount: 1,
    },
  ],
  title: 'Panel with just queries',
  type: 'timeseries',
};

export const panelWithTransformations = {
  datasource: {
    type: 'grafana-testdata-datasource',
    uid: 'gdev-testdata',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'thresholds',
      },
      custom: {
        align: 'auto',
        cellOptions: {
          type: 'auto',
        },
        inspect: false,
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 12,
    y: 0,
  },
  id: 2,
  options: {
    cellHeight: 'sm',
    footer: {
      countRows: false,
      fields: '',
      reducer: ['sum'],
      show: false,
    },
    showHeader: true,
  },
  pluginVersion: '10.3.0-pre',
  targets: [
    {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
      },
      refId: 'A',
      scenarioId: 'random_walk',
      seriesCount: 1,
    },
  ],
  title: 'Panel with transforms',
  transformations: [
    {
      id: 'reduce',
      options: {},
    },
  ],
  type: 'table',
};

export const panelWithDashboardQuery = {
  datasource: {
    type: 'datasource',
    uid: '-- Dashboard --',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 8,
  },
  id: 3,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      datasource: {
        type: 'datasource',
        uid: '-- Dashboard --',
      },
      panelId: 1,
      refId: 'A',
    },
  ],
  title: 'Panel with a Dashboard query',
  type: 'timeseries',
};

export const panelWithDashboardQueryAndTransformations = {
  datasource: {
    type: 'datasource',
    uid: '-- Dashboard --',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'thresholds',
      },
      custom: {
        align: 'auto',
        cellOptions: {
          type: 'auto',
        },
        inspect: false,
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 12,
    y: 8,
  },
  id: 4,
  options: {
    cellHeight: 'sm',
    footer: {
      countRows: false,
      fields: '',
      reducer: ['sum'],
      show: false,
    },
    showHeader: true,
  },
  pluginVersion: '10.3.0-pre',
  targets: [
    {
      datasource: {
        type: 'datasource',
        uid: '-- Dashboard --',
      },
      panelId: 1,
      refId: 'A',
    },
  ],
  title: 'Panel with a dashboard query with transformations',
  transformations: [
    {
      id: 'reduce',
      options: {},
    },
  ],
  type: 'table',
};

export const panelWithNoDataSource = {
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 5,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      refId: 'A',
    },
  ],
  title: 'Panel with no data source',
  type: 'timeseries',
};

export const panelWithDataSourceNotFound = {
  datasource: {
    type: 'datasource',
    uid: 'abc',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 6,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      refId: 'A',
    },
  ],
  title: 'Panel with no data source',
  type: 'timeseries',
};

export const panelWithQueriesAndMixedDatasource = {
  datasource: {
    type: 'datasource',
    uid: '-- Mixed --',
  },
  fieldConfig: {
    defaults: {
      color: {
        mode: 'palette-classic',
      },
      custom: {
        axisBorderShow: false,
        axisCenteredZero: false,
        axisColorMode: 'text',
        axisLabel: '',
        axisPlacement: 'auto',
        barAlignment: 0,
        drawStyle: 'line',
        fillOpacity: 0,
        gradientMode: 'none',
        hideFrom: {
          legend: false,
          tooltip: false,
          viz: false,
        },
        insertNulls: false,
        lineInterpolation: 'linear',
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: {
          type: 'linear',
        },
        showPoints: 'auto',
        spanNulls: false,
        stacking: {
          group: 'A',
          mode: 'none',
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            color: 'green',
            value: null,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      },
    },
    overrides: [],
  },
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 7,
  options: {
    legend: {
      calcs: [],
      displayMode: 'list',
      placement: 'bottom',
      showLegend: true,
    },
    tooltip: {
      mode: 'single',
      sort: 'none',
    },
  },
  targets: [
    {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
      },
      refId: 'A',
      scenarioId: 'random_walk',
      seriesCount: 1,
    },
  ],
  title: 'Panel with just queries',
  type: 'timeseries',
};

const row = {
  id: 8,
  type: 'row',
  gridPos: { h: 1, w: 24, x: 0, y: 20 },
};

const rowChild = {
  id: 9,
  type: 'timeseries',
  gridPos: { h: 2, w: 24, x: 0, y: 21 },
};

export const testDashboard = {
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: {
          type: 'grafana',
          uid: '-- Grafana --',
        },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        type: 'dashboard',
      },
    ],
  },
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 0,
  id: 2378,
  links: [],
  liveNow: false,
  panels: [
    panelWithQueriesOnly,
    panelWithTransformations,
    panelWithDashboardQuery,
    panelWithDashboardQueryAndTransformations,
    panelWithNoDataSource,
    panelWithDataSourceNotFound,
    panelWithQueriesAndMixedDatasource,
    row,
    rowChild,
    repeatedPanel,
  ],
  refresh: '',
  schemaVersion: 39,
  tags: [],
  templating: {
    list: [],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  title: 'Scenes/PanelEdit/Queries: Edit',
  uid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
  version: 6,
  weekStart: '',
};

// V2 Dashboard fixture - panels have queries with datasources but NO panel-level datasource
export const testDashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'v2-dashboard-uid',
    namespace: 'default',
    labels: {},
    generation: 1,
    resourceVersion: '1',
    creationTimestamp: new Date().toISOString(),
  },
  spec: {
    title: 'V2 Test Dashboard',
    description: 'Test dashboard for V2 schema',
    tags: [],
    cursorSync: 'Off',
    liveNow: false,
    editable: true,
    preload: false,
    links: [],
    variables: [],
    annotations: [],
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      fiscalYearStartMonth: 0,
      hideTimepicker: false,
      timezone: '',
      weekStart: undefined,
      quickRanges: [],
    },
    elements: {
      'panel-1': {
        kind: 'Panel',
        spec: {
          id: 1,
          title: 'Panel with Prometheus datasource',
          description: '',
          links: [],
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    refId: 'A',
                    hidden: false,
                    query: {
                      kind: 'DataQuery',
                      version: defaultDataQueryKind().version,
                      group: 'grafana-prometheus-datasource',
                      datasource: {
                        name: 'gdev-prometheus',
                      },
                      spec: {
                        expr: 'up',
                      },
                    },
                  },
                },
              ],
              transformations: [],
              queryOptions: {},
            },
          },
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version: '1.0.0',
            spec: {
              options: {},
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
            },
          },
        },
      },
      'panel-2': {
        kind: 'Panel',
        spec: {
          id: 2,
          title: 'Panel with TestData datasource',
          description: '',
          links: [],
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    refId: 'A',
                    hidden: false,
                    query: {
                      kind: 'DataQuery',
                      version: defaultDataQueryKind().version,
                      group: 'grafana-testdata-datasource',
                      datasource: {
                        name: 'gdev-testdata',
                      },
                      spec: {
                        scenarioId: 'random_walk',
                      },
                    },
                  },
                },
              ],
              transformations: [],
              queryOptions: {},
            },
          },
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version: '1.0.0',
            spec: {
              options: {},
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
            },
          },
        },
      },
      'panel-3': {
        kind: 'Panel',
        spec: {
          id: 3,
          title: 'Panel with no datasource on query',
          description: '',
          links: [],
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    refId: 'A',
                    hidden: false,
                    query: {
                      kind: 'DataQuery',
                      version: defaultDataQueryKind().version,
                      group: 'grafana-testdata-datasource',
                      // No datasource.name - simulates panel with no explicit datasource
                      spec: {},
                    },
                  },
                },
              ],
              transformations: [],
              queryOptions: {},
            },
          },
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version: '1.0.0',
            spec: {
              options: {},
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
            },
          },
        },
      },
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 0,
              y: 0,
              width: 12,
              height: 8,
              element: { kind: 'ElementReference', name: 'panel-1' },
            },
          },
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 12,
              y: 0,
              width: 12,
              height: 8,
              element: { kind: 'ElementReference', name: 'panel-2' },
            },
          },
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 0,
              y: 8,
              width: 12,
              height: 8,
              element: { kind: 'ElementReference', name: 'panel-3' },
            },
          },
        ],
      },
    },
  },
  access: {
    url: '/d/v2-dashboard-uid',
    slug: 'v2-test-dashboard',
  },
  apiVersion: 'v2',
};
