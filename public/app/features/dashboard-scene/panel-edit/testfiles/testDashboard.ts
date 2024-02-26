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
