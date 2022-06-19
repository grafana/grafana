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
          "calculate": true,
          "calculation": Object {
            "xBuckets": Object {
              "mode": "count",
              "value": "100",
            },
            "yBuckets": Object {
              "mode": "count",
              "scale": Object {
                "log": 2,
                "type": "log",
              },
              "value": "3",
            },
          },
          "cellGap": 2,
          "cellRadius": 10,
          "cellValues": Object {
            "decimals": undefined,
          },
          "color": Object {
            "exponent": 0.5,
            "fill": "dark-orange",
            "max": 100,
            "min": 5,
            "mode": "scheme",
            "scale": "exponential",
            "scheme": "BuGn",
            "steps": 128,
          },
          "exemplars": Object {
            "color": "rgba(255,0,255,0.7)",
          },
          "filterValues": Object {
            "le": 1e-9,
          },
          "legend": Object {
            "show": true,
          },
          "rowsFrame": Object {
            "layout": "auto",
          },
          "showValue": "never",
          "tooltip": Object {
            "show": true,
            "yHistogram": true,
          },
          "yAxis": Object {
            "axisPlacement": "left",
            "axisWidth": 400,
            "decimals": 6,
            "max": 22,
            "min": 7,
            "reverse": false,
            "unit": "short",
          },
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
    min: 5,
    max: 100,
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
    decimals: 6,
    logBase: 2,
    splitFactor: 3,
    min: 7,
    max: 22,
    width: '400',
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
