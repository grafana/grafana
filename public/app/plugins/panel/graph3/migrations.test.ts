import { PanelModel } from '@grafana/data';
import { graphPanelChangedHandler } from './migrations';

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
      show: true,
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

describe('Graph Migrations', () => {
  it('simple bars', () => {
    const old: any = {
      angular: {
        bars: true,
      },
    };
    const panel = {} as PanelModel;
    const options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchInlineSnapshot(`
      Object {
        "fieldConfig": Object {
          "defaults": Object {
            "custom": Object {
              "lineWidth": undefined,
              "mode": "bars",
              "pointSize": undefined,
            },
            "decimals": undefined,
            "nullValueMode": undefined,
          },
          "overrides": Array [],
        },
      }
    `);
    expect(options).toMatchInlineSnapshot(`
      Object {
        "graph": Object {},
        "legend": Object {
          "displayMode": "list",
          "placement": "bottom",
        },
        "tooltipOptions": Object {
          "mode": "single",
        },
      }
    `);
  });

  it('stairscase', () => {
    const old: any = {
      angular: stairscase,
    };
    const panel = {} as PanelModel;
    const options = graphPanelChangedHandler(panel, 'graph', old);
    expect(panel).toMatchInlineSnapshot(`
      Object {
        "fieldConfig": Object {
          "defaults": Object {
            "custom": Object {
              "lineInterpolation": "staircase",
              "lineWidth": undefined,
              "mode": "line",
              "pointSize": 2,
            },
            "decimals": 1,
            "nullValueMode": "null",
          },
          "overrides": Array [],
        },
      }
    `);
    expect(options).toMatchInlineSnapshot(`
      Object {
        "graph": Object {},
        "legend": Object {
          "displayMode": "list",
          "placement": "bottom",
        },
        "tooltipOptions": Object {
          "mode": "single",
        },
      }
    `);
  });
});
