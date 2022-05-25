import { PanelModel, FieldConfigSource } from '@grafana/data';

import { heatmapChangedHandler } from './migrations';

describe('Heatmap Migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('simple heatmap', () => {
    const old: any = {
      angular: oldHeatmap,
    };
    const panel = {} as PanelModel;
    panel.options = heatmapChangedHandler(panel, 'heatmap', old, prevFieldConfig);
    expect(panel).toMatchInlineSnapshot(`
      Object {
        "fieldConfig": Object {
          "defaults": Object {},
          "overrides": Array [],
        },
        "options": Object {
          "calculate": Object {
            "xAxis": Object {
              "mode": "count",
              "value": "100",
            },
            "yAxis": Object {
              "mode": "count",
              "value": "20",
            },
          },
          "cellGap": 2,
          "cellSize": 10,
          "color": Object {
            "exponent": 0.5,
            "fill": "dark-orange",
            "mode": "scheme",
            "scale": "exponential",
            "scheme": "BuGn",
            "steps": 256,
          },
          "exemplars": Object {
            "color": "rgba(255,0,255,0.7)",
          },
          "legend": Object {
            "show": true,
          },
          "mode": "calculate",
          "showValue": "never",
          "tooltip": Object {
            "show": true,
            "yHistogram": true,
          },
          "yAxisLabels": "auto",
          "yAxisReverse": false,
        },
      }
    `);
  });
});

const oldHeatmap = {
  id: 4,
  gridPos: {
    x: 0,
    y: 0,
    w: 12,
    h: 8,
  },
  type: 'heatmap',
  title: 'Panel Title',
  datasource: {
    uid: '000000051',
    type: 'testdata',
  },
  targets: [
    {
      scenarioId: 'random_walk',
      refId: 'A',
      datasource: {
        uid: '000000051',
        type: 'testdata',
      },
      startValue: 0,
      seriesCount: 5,
      spread: 10,
    },
  ],
  heatmap: {},
  cards: {
    cardPadding: 2,
    cardRound: 10,
  },
  color: {
    mode: 'spectrum',
    cardColor: '#b4ff00',
    colorScale: 'sqrt',
    exponent: 0.5,
    colorScheme: 'interpolateBuGn',
    min: null,
    max: null,
  },
  legend: {
    show: true,
  },
  dataFormat: 'timeseries',
  yBucketBound: 'auto',
  reverseYBuckets: false,
  xAxis: {
    show: true,
  },
  yAxis: {
    show: true,
    format: 'short',
    decimals: null,
    logBase: 1,
    splitFactor: null,
    min: null,
    max: null,
  },
  xBucketSize: null,
  xBucketNumber: 100,
  yBucketSize: null,
  yBucketNumber: 20,
  tooltip: {
    show: true,
    showHistogram: true,
  },
  highlightCards: true,
  hideZeroBuckets: true,
};
