import { PanelModel, FieldConfigSource } from '@grafana/data';

import { mapMigrationHandler, mapPanelChangedHandler } from './migrations';
describe('Worldmap Migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('simple worldmap', () => {
    const old: any = {
      angular: simpleWorldmapConfig,
    };
    const panel = {} as PanelModel;
    panel.options = mapPanelChangedHandler(panel, 'grafana-worldmap-panel', old, prevFieldConfig);
    expect(panel).toMatchInlineSnapshot(`
      {
        "fieldConfig": {
          "defaults": {
            "decimals": 3,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "#37872D",
                  "value": -Infinity,
                },
                {
                  "color": "#E0B400",
                  "value": 0,
                },
                {
                  "color": "#C4162A",
                  "value": 50,
                },
                {
                  "color": "#8F3BB8",
                  "value": 100,
                },
              ],
            },
          },
          "overrides": [],
        },
        "options": {
          "basemap": {
            "name": "Basemap",
            "type": "default",
          },
          "controls": {
            "mouseWheelZoom": true,
            "showZoom": true,
          },
          "layers": [
            {
              "config": {
                "showLegend": true,
                "style": {
                  "color": {
                    "fixed": "dark-green",
                  },
                  "opacity": 0.4,
                  "rotation": {
                    "fixed": 0,
                    "max": 360,
                    "min": -360,
                    "mode": "mod",
                  },
                  "size": {
                    "fixed": 5,
                    "max": 30,
                    "min": 2,
                  },
                  "symbol": {
                    "fixed": "img/icons/marker/circle.svg",
                    "mode": "fixed",
                  },
                  "textConfig": {
                    "fontSize": 12,
                    "offsetX": 0,
                    "offsetY": 0,
                    "textAlign": "center",
                    "textBaseline": "middle",
                  },
                },
              },
              "location": {
                "gazetteer": "public/gazetteer/countries.json",
                "lookup": undefined,
                "mode": "lookup",
              },
              "name": "",
              "tooltip": true,
              "type": "markers",
            },
          ],
          "tooltip": {
            "mode": "details",
          },
          "view": {
            "id": "europe",
            "lat": 46,
            "lon": 14,
            "zoom": 6,
          },
        },
        "transformations": [
          {
            "id": "reduce",
            "options": {
              "reducers": [
                "sum",
              ],
            },
          },
        ],
      }
    `);
  });
});

const simpleWorldmapConfig = {
  id: 23763571993,
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  type: 'grafana-worldmap-panel',
  title: 'Panel Title',
  thresholds: '0,50,100',
  maxDataPoints: 1,
  circleMaxSize: 30,
  circleMinSize: 2,
  colors: ['#37872D', '#E0B400', '#C4162A', '#8F3BB8'],
  decimals: 3,
  esMetric: 'Count',
  hideEmpty: false,
  hideZero: false,
  initialZoom: '6',
  locationData: 'countries',
  mapCenter: 'Europe',
  mapCenterLatitude: 46,
  mapCenterLongitude: 14,
  mouseWheelZoom: true,
  showLegend: true,
  stickyLabels: false,
  tableQueryOptions: {
    geohashField: 'geohash',
    latitudeField: 'latitude',
    longitudeField: 'longitude',
    metricField: 'metric',
    queryType: 'geohash',
  },
  unitPlural: '',
  unitSingle: '',
  valueName: 'total',
  datasource: null,
};

describe('geomap migrations', () => {
  it('updates marker', () => {
    const panel = {
      type: 'geomap',
      options: {
        layers: [
          {
            type: 'markers',
            config: {
              size: {
                fixed: 5,
                min: 2,
                max: 15,
                field: 'Count',
              },
              color: {
                fixed: 'dark-green',
                field: 'Price',
              },
              fillOpacity: 0.4,
              shape: 'triangle',
              showLegend: true,
            },
          },
        ],
      },
      pluginVersion: '8.2.0',
    } as unknown as PanelModel;
    panel.options = mapMigrationHandler(panel);

    expect(panel).toMatchInlineSnapshot(`
      {
        "options": {
          "layers": [
            {
              "config": {
                "showLegend": true,
                "style": {
                  "color": {
                    "field": "Price",
                    "fixed": "dark-green",
                  },
                  "opacity": 0.4,
                  "rotation": {
                    "fixed": 0,
                    "max": 360,
                    "min": -360,
                    "mode": "mod",
                  },
                  "size": {
                    "field": "Count",
                    "fixed": 5,
                    "max": 15,
                    "min": 2,
                  },
                  "symbol": {
                    "fixed": "img/icons/marker/triangle.svg",
                    "mode": "fixed",
                  },
                  "textConfig": {
                    "fontSize": 12,
                    "offsetX": 0,
                    "offsetY": 0,
                    "textAlign": "center",
                    "textBaseline": "middle",
                  },
                },
              },
              "type": "markers",
            },
          ],
        },
        "pluginVersion": "8.2.0",
        "type": "geomap",
      }
    `);
  });
});
