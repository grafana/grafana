import { PanelModel, FieldConfigSource } from '@grafana/data';

import { heatmapChangedHandler, heatmapMigrationHandler } from './migrations';

describe('Heatmap Migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('simple heatmap', () => {
    const panel = {} as PanelModel;
    panel.options = heatmapChangedHandler(
      panel,
      'heatmap',
      {
        angular: oldHeatmap,
      },
      prevFieldConfig
    );
    expect(panel).toMatchInlineSnapshot(`
      {
        "fieldConfig": {
          "defaults": {},
          "overrides": [],
        },
        "options": {
          "calculate": true,
          "calculation": {
            "xBuckets": {
              "mode": "count",
              "value": "100",
            },
            "yBuckets": {
              "mode": "count",
              "scale": {
                "log": 2,
                "type": "log",
              },
              "value": "3",
            },
          },
          "cellGap": 2,
          "cellRadius": 10,
          "cellValues": {
            "decimals": undefined,
          },
          "color": {
            "exponent": 0.5,
            "fill": "#b4ff00",
            "max": 100,
            "min": 5,
            "mode": "scheme",
            "reverse": true,
            "scale": "exponential",
            "scheme": "BuGn",
            "steps": 128,
          },
          "exemplars": {
            "color": "rgba(255,0,255,0.7)",
          },
          "filterValues": {
            "le": 1e-9,
          },
          "legend": {
            "show": true,
          },
          "rowsFrame": {
            "layout": "auto",
          },
          "showValue": "never",
          "tooltip": {
            "mode": "single",
            "yHistogram": true,
          },
          "yAxis": {
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

  it('Null Options', () => {
    const panel = {} as PanelModel;
    panel.options = null;
    panel.options = heatmapMigrationHandler(panel);
    expect(panel).toMatchInlineSnapshot(`
      {
        "fieldConfig": {
          "defaults": {},
          "overrides": [],
        },
        "options": {
          "calculate": true,
          "calculation": {},
          "cellGap": 2,
          "cellRadius": undefined,
          "cellValues": {
            "decimals": undefined,
          },
          "color": {
            "exponent": 0.5,
            "fill": undefined,
            "max": undefined,
            "min": undefined,
            "mode": "scheme",
            "reverse": false,
            "scale": "exponential",
            "scheme": "Oranges",
            "steps": 128,
          },
          "exemplars": {
            "color": "rgba(255,0,255,0.7)",
          },
          "legend": {
            "show": false,
          },
          "rowsFrame": {
            "layout": "auto",
          },
          "showValue": "never",
          "tooltip": {
            "mode": "none",
            "yHistogram": false,
          },
          "yAxis": {
            "axisPlacement": "left",
            "axisWidth": undefined,
            "decimals": undefined,
            "max": undefined,
            "min": undefined,
            "reverse": false,
            "unit": undefined,
          },
        },
      }
    `);
  });

  it('Cell padding defaults', () => {
    // zero becomes 1
    expect(
      heatmapChangedHandler(
        {} as PanelModel,
        'heatmap',
        {
          angular: { cards: { cardPadding: 0 } },
        },
        prevFieldConfig
      ).cellGap
    ).toEqual(1);

    // missing is 2
    expect(
      heatmapChangedHandler(
        {} as PanelModel,
        'heatmap',
        {
          angular: {},
        },
        prevFieldConfig
      ).cellGap
    ).toEqual(2);
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
    min: 100,
    max: 5,
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
