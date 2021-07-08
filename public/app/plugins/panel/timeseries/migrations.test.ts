import { PanelModel, FieldConfigSource } from '@grafana/data';
import { graphPanelChangedHandler } from './migrations';
import { cloneDeep } from 'lodash';

describe('Graph Migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('simple bars', () => {
    const old: any = {
      angular: {
        bars: true,
      },
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('stairscase', () => {
    const old: any = {
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
    const old: any = {
      angular: twoYAxis,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('stepped line', () => {
    const old: any = {
      angular: stepedColordLine,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('preserves colors from series overrides', () => {
    const old: any = {
      angular: customColor,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  it('preserves series overrides using a regex alias', () => {
    const old: any = {
      angular: customColorRegex,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel).toMatchSnapshot();
  });

  describe('legend', () => {
    test('without values', () => {
      const old: any = {
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
      const old: any = {
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
      const old: any = {
        angular: legend,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
  });

  describe('stacking', () => {
    test('simple', () => {
      const old: any = {
        angular: stacking,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
    test('groups', () => {
      const old: any = {
        angular: stackingGroups,
      };
      const panel = {} as PanelModel;
      panel.options = graphPanelChangedHandler(panel, 'graph', old, prevFieldConfig);
      expect(panel).toMatchSnapshot();
    });
  });

  describe('thresholds', () => {
    test('Only gt thresholds', () => {
      const old: any = {
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
        Array [
          Object {
            "color": "transparent",
            "value": -Infinity,
          },
          Object {
            "color": "orange",
            "value": 50,
          },
          Object {
            "color": "red",
            "value": 80,
          },
        ]
      `);
    });

    test('gt & lt thresholds', () => {
      const old: any = {
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
        Array [
          Object {
            "color": "orange",
            "value": -Infinity,
          },
          Object {
            "color": "transparent",
            "value": 40,
          },
          Object {
            "color": "red",
            "value": 80,
          },
        ]
      `);
    });

    test('Only lt thresholds', () => {
      const old: any = {
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
        Array [
          Object {
            "color": "orange",
            "value": -Infinity,
          },
          Object {
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
