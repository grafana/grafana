import { cloneDeep } from 'lodash';

import { PanelModel, FieldConfigSource, FieldMatcherID, ReducerID } from '@grafana/data';
import { TooltipDisplayMode, SortOrder } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel as PanelModelState } from 'app/features/dashboard/state/PanelModel';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { dataLayersToAnnotations } from 'app/features/dashboard-scene/serialization/dataLayersToAnnotations';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { dashboardSceneGraph } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { graphPanelChangedHandler } from './migrations';

describe('Graph Migrations', () => {
  let prevFieldConfig: FieldConfigSource;
  let dashboard: DashboardModel;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };

    dashboard = createDashboardModelFixture({
      id: 74,
      version: 7,
      annotations: {},
      links: [],
      panels: [],
    });

    getDashboardSrv().setCurrent(dashboard);
  });

  it('simple bars', () => {
    const old = {
      angular: {
        bars: true,
      },
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('stairscase', () => {
    const old = {
      angular: stairscase,
    };
    const panel = {} as PanelModel;

    prevFieldConfig = {
      defaults: {
        custom: {},
        unit: 'areaF2',
        displayName: 'DISPLAY NAME',
      },
      overrides: [],
    };
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('twoYAxis', () => {
    const old = {
      angular: twoYAxis,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('stepped line', () => {
    const old = {
      angular: stepedColordLine,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('preserves colors from series overrides', () => {
    const old = {
      angular: customColor,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('preserves series overrides using a regex alias', () => {
    const old = {
      angular: customColorRegex,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
    expect(panel.fieldConfig.overrides[0].matcher.id).toBe(FieldMatcherID.byRegexp);
    expect(panel.fieldConfig.overrides[1].matcher.id).toBe(FieldMatcherID.byRegexp);
  });

  describe('time regions', () => {
    test('should migrate', () => {
      const old = {
        angular: {
          timeRegions: [
            {
              colorMode: 'red',
              fill: true,
              fillColor: 'rgba(234, 112, 112, 0.12)',
              fromDayOfWeek: 1,
              line: true,
              lineColor: 'rgba(237, 46, 24, 0.60)',
              op: 'time',
            },
          ],
        },
      };

      const panel = { datasource: { type: 'datasource', uid: 'gdev-testdata' } } as PanelModel;
      dashboard.panels.push(new PanelModelState(panel));
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(dashboard.panels).toHaveLength(1);
      expect(dashboard.annotations.list).toHaveLength(2); // built-in + time region
      expect(
        dashboard.annotations.list.filter((annotation) => annotation.target?.queryType === GrafanaQueryType.TimeRegions)
      ).toHaveLength(1);
      expect(panel).toMatchSnapshot();
    });

    test('should migrate in scenes dashboard', () => {
      const old = {
        angular: {
          timeRegions: [
            {
              colorMode: 'red',
              fill: true,
              fillColor: 'rgba(234, 112, 112, 0.12)',
              fromDayOfWeek: 1,
              line: true,
              lineColor: 'rgba(237, 46, 24, 0.60)',
              op: 'time',
            },
          ],
        },
      };

      const panel = { datasource: { type: 'datasource', uid: 'gdev-testdata' } } as PanelModel;

      dashboard.panels.push(new PanelModelState(panel));

      const scene = transformSaveModelToScene({ dashboard, meta: {} });
      window.__grafanaSceneContext = scene;

      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);

      const layers = dashboardSceneGraph.getDataLayers(scene).state.annotationLayers;
      const annotations = dataLayersToAnnotations(layers);

      expect(annotations).toHaveLength(2); // built-in + time region
      expect(
        annotations.filter((annotation) => annotation.target?.queryType === GrafanaQueryType.TimeRegions)
      ).toHaveLength(1);
      expect(panel).toMatchSnapshot();
    });
  });

  describe('legend', () => {
    test('without values', () => {
      const old = {
        angular: {
          legend: {
            show: true,
            values: false,
            min: false,
            max: false,
            current: false,
            total: false,
            avg: false,
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
    test('with single value', () => {
      const old = {
        angular: {
          legend: {
            show: true,
            values: true,
            min: false,
            max: false,
            current: false,
            total: true,
            avg: false,
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
    test('with multiple values', () => {
      const old = {
        angular: legend,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
    test('with sideWidth', () => {
      const old = {
        angular: {
          legend: {
            alignAsTable: true,
            rightSide: true,
            show: true,
            sideWidth: 200,
            total: true,
            values: true,
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.options.legend.width).toBe(200);
    });

    test('hide allZeros', () => {
      const old = {
        angular: {
          legend: {
            show: true,
            values: false,
            min: false,
            max: false,
            current: false,
            total: false,
            avg: false,
            hideZero: true,
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.overrides).toHaveLength(1);
      expect(panel.fieldConfig.overrides[0].matcher.options.reducer).toBe(ReducerID.allIsZero);
      expect(panel.fieldConfig.overrides).toMatchInlineSnapshot(`
        [
          {
            "matcher": {
              "id": "byValue",
              "options": {
                "op": "gte",
                "reducer": "allIsZero",
                "value": 0,
              },
            },
            "properties": [
              {
                "id": "custom.hideFrom",
                "value": {
                  "legend": true,
                  "tooltip": true,
                  "viz": false,
                },
              },
            ],
          },
        ]
      `);
    });

    test('hide allZeros allNulls', () => {
      const old = {
        angular: {
          legend: {
            show: true,
            values: false,
            min: false,
            max: false,
            current: false,
            total: false,
            avg: false,
            hideEmpty: true,
            hideZero: true,
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.overrides).toHaveLength(2);
      expect(panel.fieldConfig.overrides).toMatchInlineSnapshot(`
        [
          {
            "matcher": {
              "id": "byValue",
              "options": {
                "op": "gte",
                "reducer": "allIsZero",
                "value": 0,
              },
            },
            "properties": [
              {
                "id": "custom.hideFrom",
                "value": {
                  "legend": true,
                  "tooltip": true,
                  "viz": false,
                },
              },
            ],
          },
          {
            "matcher": {
              "id": "byValue",
              "options": {
                "op": "gte",
                "reducer": "allIsNull",
                "value": 0,
              },
            },
            "properties": [
              {
                "id": "custom.hideFrom",
                "value": {
                  "legend": true,
                  "tooltip": true,
                  "viz": false,
                },
              },
            ],
          },
        ]
      `);
    });
  });

  describe('stacking', () => {
    test('simple', () => {
      const old = {
        angular: stacking,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
    test('groups', () => {
      const old = {
        angular: stackingGroups,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
  });

  describe('thresholds', () => {
    test('Only gt thresholds', () => {
      const old = {
        angular: {
          thresholds: [
            {
              colorMode: 'critical',
              fill: true,
              line: false,
              op: 'gt',
              value: 80,
              yaxis: 'left',
            },
            {
              colorMode: 'warning',
              fill: true,
              line: false,
              op: 'gt',
              value: 50,
              yaxis: 'left',
            },
          ],
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.thresholdsStyle.mode).toBe('area');
      expect(panel.fieldConfig.defaults.thresholds?.steps).toMatchInlineSnapshot(`
        [
          {
            "color": "transparent",
            "value": -Infinity,
          },
          {
            "color": "orange",
            "value": 50,
          },
          {
            "color": "red",
            "value": 80,
          },
        ]
      `);
    });

    test('gt & lt thresholds', () => {
      const old = {
        angular: {
          thresholds: [
            {
              colorMode: 'critical',
              fill: true,
              line: true,
              op: 'gt',
              value: 80,
              yaxis: 'left',
            },
            {
              colorMode: 'warning',
              fill: true,
              line: true,
              op: 'lt',
              value: 40,
              yaxis: 'left',
            },
          ],
        },
      };

      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.thresholdsStyle.mode).toBe('line+area');
      expect(panel.fieldConfig.defaults.thresholds?.steps).toMatchInlineSnapshot(`
        [
          {
            "color": "orange",
            "value": -Infinity,
          },
          {
            "color": "transparent",
            "value": 40,
          },
          {
            "color": "red",
            "value": 80,
          },
        ]
      `);
    });

    test('Only lt thresholds', () => {
      const old = {
        angular: {
          thresholds: [
            {
              colorMode: 'warning',
              fill: true,
              line: true,
              op: 'lt',
              value: 40,
              yaxis: 'left',
            },
          ],
        },
      };

      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.thresholdsStyle.mode).toBe('line+area');
      expect(panel.fieldConfig.defaults.thresholds?.steps).toMatchInlineSnapshot(`
        [
          {
            "color": "orange",
            "value": -Infinity,
          },
          {
            "color": "transparent",
            "value": 40,
          },
        ]
      `);
    });

    test('hide series', () => {
      const panel = {} as PanelModel;
      panel.fieldConfig = {
        defaults: {
          custom: {
            hideFrom: {
              tooltip: false,
              graph: false,
              legend: false,
            },
          },
        },
        overrides: [
          {
            matcher: {
              id: 'byNames',
              options: {
                mode: 'exclude',
                names: ['Bedroom'],
                prefix: 'All except:',
                readOnly: true,
              },
            },
            properties: [
              {
                id: 'custom.hideFrom',
                value: {
                  graph: true,
                  legend: false,
                  tooltip: false,
                },
              },
            ],
          },
        ],
      };

      panel.options = graphPanelChangedHandler(panel, 'graph', {}, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.hideFrom).toEqual({ viz: false, legend: false, tooltip: false });
      expect(panel.fieldConfig.overrides[0].properties[0].value).toEqual({ viz: true, legend: false, tooltip: false });
    });
  });

  describe('tooltip', () => {
    test('tooltip mode', () => {
      const single = {
        angular: {
          tooltip: {
            shared: false,
          },
        },
      };
      const multi = {
        angular: {
          tooltip: {
            shared: true,
          },
        },
      };

      const panel1 = {} as PanelModel;
      const panel2 = {} as PanelModel;

      panel1.options = graphPanelChangedHandler(panel1, 'graph', single, prevFieldConfig);
      panel2.options = graphPanelChangedHandler(panel2, 'graph', multi, prevFieldConfig);

      expect(panel1.options.tooltip.mode).toBe(TooltipDisplayMode.Single);
      expect(panel2.options.tooltip.mode).toBe(TooltipDisplayMode.Multi);
    });

    test('sort order', () => {
      const none = {
        angular: {
          tooltip: {
            shared: true,
            sort: 0,
          },
        },
      };

      const asc = {
        angular: {
          tooltip: {
            shared: true,
            sort: 1,
          },
        },
      };

      const desc = {
        angular: {
          tooltip: {
            shared: true,
            sort: 2,
          },
        },
      };

      const singleModeWithUnnecessaryOption = {
        angular: {
          tooltip: {
            shared: false,
            sort: 2,
          },
        },
      };

      const panel1 = {} as PanelModel;
      const panel2 = {} as PanelModel;
      const panel3 = {} as PanelModel;
      const panel4 = {} as PanelModel;

      panel1.options = graphPanelChangedHandler(panel1, 'graph', none, prevFieldConfig);
      panel2.options = graphPanelChangedHandler(panel2, 'graph', asc, prevFieldConfig);
      panel3.options = graphPanelChangedHandler(panel3, 'graph', desc, prevFieldConfig);
      panel4.options = graphPanelChangedHandler(panel4, 'graph', singleModeWithUnnecessaryOption, prevFieldConfig);

      expect(panel1.options.tooltip.sort).toBe(SortOrder.None);
      expect(panel2.options.tooltip.sort).toBe(SortOrder.Ascending);
      expect(panel3.options.tooltip.sort).toBe(SortOrder.Descending);
      expect(panel4.options.tooltip.sort).toBe(SortOrder.None);
    });
  });

  describe('x axis', () => {
    test('should hide x axis', () => {
      const old = {
        angular: {
          xaxis: {
            show: false,
            mode: 'time',
          },
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig).toMatchSnapshot();
    });
  });

  describe('transforms', () => {
    test.each(['negative-Y', 'constant'])('should preserve %p transform', (transform) => {
      const old = {
        angular: {
          seriesOverrides: [
            {
              alias: 'out',
              transform,
            },
          ],
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig).toMatchSnapshot();
    });
  });

  describe('null values', () => {
    test('nullPointMode = null', () => {
      const old = {
        angular: {
          nullPointMode: 'null',
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.spanNulls).toBeFalsy();
    });
    test('nullPointMode = connected', () => {
      const old = {
        angular: {
          nullPointMode: 'connected',
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.defaults.custom.spanNulls).toBeTruthy();
    });
  });

  describe('seriesOverride lines: true', () => {
    test('Should set displayMode', () => {
      const old = {
        angular: {
          bars: true,
          lines: false,
          seriesOverrides: [
            {
              alias: 'A-series',
              lines: true,
            },
          ],
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.overrides[0]).toEqual({
        matcher: { id: 'byName', options: 'A-series' },
        properties: [{ id: 'custom.drawStyle', value: 'line' }],
      });
    });
  });

  describe('seriesOverride lines: false', () => {
    test('Should set lineWidth 0', () => {
      const old = {
        angular: {
          lines: true,
          seriesOverrides: [
            {
              alias: 'A-series',
              lines: false,
            },
          ],
        },
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel.fieldConfig.overrides[0]).toEqual({
        matcher: { id: 'byName', options: 'A-series' },
        properties: [{ id: 'custom.lineWidth', value: 0 }],
      });
    });
  });
});

const customColor = {
  aliasColors: {},
  dashLength: 10,
  fill: 5,
  fillGradient: 6,
  legend: {
    avg: true,
    current: true,
    max: true,
    min: true,
    show: true,
    total: true,
    values: true,
    alignAsTable: true,
  },
  lines: true,
  linewidth: 1,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pointradius: 2,
  seriesOverrides: [
    {
      $$hashKey: 'object:12',
      alias: 'A-series',
      color: 'rgba(165, 72, 170, 0.77)',
    },
    {
      $$hashKey: 'object:13',
      alias: 'B-series',
      color: 'rgba(16, 72, 170, 0.77)',
    },
  ],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:42',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: false,
    },
    {
      $$hashKey: 'object:43',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  timeFrom: null,
  timeShift: null,
  bars: false,
  dashes: false,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: false,
  decimals: 1,
  datasource: null,
};

const customColorRegex = cloneDeep(customColor);
customColorRegex.seriesOverrides[0].alias = '/^A-/';
customColorRegex.seriesOverrides[1].alias = '/.*Status: 2[0-9]+.*/i';

const stairscase = {
  aliasColors: {},
  dashLength: 10,
  fill: 5,
  fillGradient: 6,
  legend: {
    avg: true,
    current: true,
    max: true,
    min: true,
    show: true,
    total: true,
    values: true,
    alignAsTable: true,
  },
  lines: true,
  linewidth: 1,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pointradius: 2,
  seriesOverrides: [],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:42',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: false,
    },
    {
      $$hashKey: 'object:43',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  timeFrom: null,
  timeShift: null,
  bars: false,
  dashes: false,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: false,
  decimals: 1,
  datasource: null,
};

const twoYAxis = {
  yaxes: [
    {
      label: 'Y111',
      show: true,
      logBase: 10,
      min: '0',
      max: '1000',
      format: 'areaMI2',
      $$hashKey: 'object:19',
      decimals: 3,
    },
    {
      label: 'Y222',
      show: true,
      logBase: 1,
      min: '-10',
      max: '25',
      format: 'degree',
      $$hashKey: 'object:20',
      decimals: 2,
    },
  ],
  xaxis: {
    show: true,
    mode: 'time',
    name: null,
    values: [],
    buckets: null,
  },
  yaxis: {
    align: false,
    alignLevel: null,
  },
  lines: true,
  fill: 1,
  linewidth: 1,
  dashLength: 10,
  spaceLength: 10,
  pointradius: 2,
  legend: {
    show: true,
    values: false,
    min: false,
    max: false,
    current: false,
    total: false,
    avg: false,
  },
  nullPointMode: 'null',
  tooltip: {
    value_type: 'individual',
    shared: true,
    sort: 0,
  },
  aliasColors: {},
  seriesOverrides: [
    {
      alias: 'B-series',
      yaxis: 2,
      dashLength: 5,
      dashes: true,
      spaceLength: 8,
    },
  ],
  thresholds: [],
  timeRegions: [],
  targets: [
    {
      refId: 'A',
    },
    {
      refId: 'B',
    },
  ],
  fillGradient: 0,
  dashes: true,
  hiddenSeries: false,
  points: false,
  bars: false,
  stack: false,
  percentage: false,
  steppedLine: false,
  timeFrom: null,
  timeShift: null,
  datasource: null,
};

const stepedColordLine = {
  aliasColors: {
    'A-series': 'red',
  },
  dashLength: 10,
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  fill: 5,
  gridPos: {
    h: 9,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 2,
  legend: {
    avg: false,
    current: false,
    max: false,
    min: false,
    show: true,
    total: false,
    values: false,
  },
  lines: true,
  linewidth: 5,
  maxDataPoints: 20,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pluginVersion: '7.4.0-pre',
  pointradius: 2,
  renderer: 'flot',
  seriesOverrides: [],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:38',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
    {
      $$hashKey: 'object:39',
      format: 'short',
      label: null,
      logBase: 10,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  bars: false,
  dashes: false,
  fillGradient: 0,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: false,
  timeFrom: null,
  timeShift: null,
  datasource: null,
};

const legend = {
  aliasColors: {
    'A-series': 'red',
  },
  dashLength: 10,
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  fill: 5,
  gridPos: {
    h: 9,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 2,
  legend: {
    avg: true,
    current: true,
    max: false,
    min: false,
    show: true,
    total: true,
    values: true,
    alignAsTable: true,
  },
  lines: true,
  linewidth: 5,
  maxDataPoints: 20,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pluginVersion: '7.4.0-pre',
  pointradius: 2,
  renderer: 'flot',
  seriesOverrides: [],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:38',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
    {
      $$hashKey: 'object:39',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  bars: false,
  dashes: false,
  fillGradient: 0,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: false,
  timeFrom: null,
  timeShift: null,
  datasource: null,
};

const stacking = {
  aliasColors: {
    'A-series': 'red',
  },
  dashLength: 10,
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  fill: 5,
  gridPos: {
    h: 9,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 2,
  legend: {
    avg: true,
    current: true,
    max: false,
    min: false,
    show: true,
    total: true,
    values: true,
    alignAsTable: true,
  },
  lines: true,
  linewidth: 5,
  maxDataPoints: 20,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pluginVersion: '7.4.0-pre',
  pointradius: 2,
  renderer: 'flot',
  seriesOverrides: [],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:38',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
    {
      $$hashKey: 'object:39',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  bars: false,
  dashes: false,
  fillGradient: 0,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: true,
  timeFrom: null,
  timeShift: null,
  datasource: null,
};

const stackingGroups = {
  aliasColors: {
    'A-series': 'red',
  },
  dashLength: 10,
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  fill: 5,
  gridPos: {
    h: 9,
    w: 12,
    x: 0,
    y: 0,
  },
  id: 2,
  legend: {
    avg: true,
    current: true,
    max: false,
    min: false,
    show: true,
    total: true,
    values: true,
    alignAsTable: true,
  },
  lines: true,
  linewidth: 5,
  maxDataPoints: 20,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  pluginVersion: '7.4.0-pre',
  pointradius: 2,
  renderer: 'flot',
  seriesOverrides: [
    {
      alias: 'A-series',
      stack: 'A',
    },
    {
      alias: 'B-series',
      stack: 'A',
    },
  ],
  spaceLength: 10,
  steppedLine: true,
  thresholds: [],
  timeRegions: [],
  title: 'Panel Title',
  tooltip: {
    shared: true,
    sort: 0,
    value_type: 'individual',
  },
  type: 'graph',
  xaxis: {
    buckets: null,
    mode: 'time',
    name: null,
    show: true,
    values: [],
  },
  yaxes: [
    {
      $$hashKey: 'object:38',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
    {
      $$hashKey: 'object:39',
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
  ],
  yaxis: {
    align: false,
    alignLevel: null,
  },
  bars: false,
  dashes: false,
  fillGradient: 0,
  hiddenSeries: false,
  percentage: false,
  points: false,
  stack: true,
  timeFrom: null,
  timeShift: null,
  datasource: null,
};
