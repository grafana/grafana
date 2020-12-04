import { PanelModel } from '@grafana/data';
import { graphPanelChangedHandler } from './migrations.ts';
import { BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { BigValueTextMode } from '@grafana/ui/src/components/BigValue/BigValue';

const sheetsExample = {
  aliasColors: {},
  bars: false,
  dashLength: 10,
  dashes: false,
  datasource: 'Google Sheets',
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  fill: 1,
  fillGradient: 0,
  gridPos: {
    h: 15,
    w: 24,
    x: 0,
    y: 0,
  },
  hiddenSeries: false,
  id: 23763571993,
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
  linewidth: 1,
  nullPointMode: 'null',
  options: {
    alertThreshold: true,
  },
  percentage: false,
  pluginVersion: '7.4.0-pre',
  pointradius: 2,
  points: true,
  renderer: 'flot',
  seriesOverrides: [
    {
      alias: 'A-series1',
      bars: true,
      lines: false,
      points: false,
    },
    {
      alias: 'A-series2',
      steppedLine: true,
    },
    {
      alias: 'A-series4',
      lines: false,
    },
  ],
  spaceLength: 10,
  stack: false,
  steppedLine: false,
  targets: [
    {
      cacheDurationSeconds: 300,
      refId: 'A',
      spreadsheet: '1OSA1BEgeUN28EXI86iZl2oU3q66uQ88pF1JsbMFq87A',
      useTimeFilter: true,
    },
  ],
  thresholds: [],
  timeFrom: null,
  timeRegions: [],
  timeShift: null,
  title: 'Flot',
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
      format: 'short',
      label: null,
      logBase: 1,
      max: null,
      min: null,
      show: true,
    },
    {
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
};

describe('Graph Migrations', () => {
  it('change from flot to uplot graph', () => {
    const old: any = {
      angular: sheetsExample,
    };
    const panel = {} as PanelModel;
    const options = graphPanelChangedHandler(panel, 'graph', old);
    expect(options).toMatchInlineSnapshot();
  });
});
