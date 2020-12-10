import { PanelModel } from '@grafana/data';
import { graphPanelChangedHandler } from './migrations';

describe('Graph Migrations', () => {
  it('simple bars', () => {
    const old: any = {
      angular: {
        bars: true,
      },
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchSnapshot();
  });

  it('stairscase', () => {
    const old: any = {
      angular: stairscase,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchSnapshot();
  });

  it('twoYAxis', () => {
    const old: any = {
      angular: twoYAxis,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchSnapshot();
  });

  it('stepped line', () => {
    const old: any = {
      angular: stepedColordLine,
    };
    const panel = {} as PanelModel;
    panel.options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchSnapshot();
  });
});

const stairscase = {
  fieldConfig: {
    defaults: {
      custom: {},
      unit: 'areaF2',
      displayName: 'DISPLAY NAME',
    },
    overrides: [],
  },
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
  dashes: false,
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
