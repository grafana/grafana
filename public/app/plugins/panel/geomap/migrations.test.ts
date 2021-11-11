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
      Object {
        "fieldConfig": Object {
          "defaults": Object {
            "decimals": 3,
            "thresholds": Object {
              "mode": "absolute",
              "steps": Array [
                Object {
                  "color": "#37872D",
                  "value": -Infinity,
                },
                Object {
                  "color": "#E0B400",
                  "value": 0,
                },
                Object {
                  "color": "#C4162A",
                  "value": 50,
                },
                Object {
                  "color": "#8F3BB8",
                  "value": 100,
                },
              ],
            },
          },
          "overrides": Array [],
        },
        "options": Object {
          "basemap": Object {
            "type": "default",
          },
          "controls": Object {
            "mouseWheelZoom": true,
            "showZoom": true,
          },
          "layers": Array [],
          "view": Object {
            "id": "europe",
            "lat": 46,
            "lon": 14,
            "zoom": 6,
          },
        },
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
      id: 2,
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 0,
      },
      type: 'geomap',
      title: 'Panel Title',
      fieldConfig: {
        defaults: {
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
          mappings: [],
          color: {
            mode: 'thresholds',
          },
        },
        overrides: [],
      },
      options: {
        view: {
          id: 'zero',
          lat: 0,
          lon: 0,
          zoom: 1,
        },
        basemap: {
          type: 'default',
          config: {},
        },
        layers: [
          {
            config: {
              color: {
                fixed: 'dark-green',
              },
              fillOpacity: 0.4,
              markerSymbol: {
                fixed: '',
                mode: 'fixed',
              },
              shape: 'circle',
              showLegend: true,
              size: {
                fixed: 5,
                max: 15,
                min: 2,
              },
            },
            location: {
              mode: 'auto',
            },
            type: 'markers',
          },
        ],
        controls: {
          showZoom: true,
          mouseWheelZoom: true,
          showAttribution: true,
          showScale: false,
          showDebug: false,
        },
      },
      pluginVersion: '8.3.0-pre',
      datasource: null,
    } as PanelModel;
    panel.options = mapMigrationHandler(panel);

    expect(panel).toMatchInlineSnapshot(`
      Object {
        "datasource": null,
        "fieldConfig": Object {
          "defaults": Object {
            "color": Object {
              "mode": "thresholds",
            },
            "mappings": Array [],
            "thresholds": Object {
              "mode": "absolute",
              "steps": Array [
                Object {
                  "color": "green",
                  "value": null,
                },
                Object {
                  "color": "red",
                  "value": 80,
                },
              ],
            },
          },
          "overrides": Array [],
        },
        "gridPos": Object {
          "h": 9,
          "w": 12,
          "x": 0,
          "y": 0,
        },
        "id": 2,
        "options": Object {
          "basemap": Object {
            "config": Object {},
            "type": "default",
          },
          "controls": Object {
            "mouseWheelZoom": true,
            "showAttribution": true,
            "showDebug": false,
            "showScale": false,
            "showZoom": true,
          },
          "layers": Array [
            Object {
              "config": Object {
                "color": Object {
                  "fixed": "dark-green",
                },
                "fillOpacity": 0.4,
                "markerSymbol": Object {
                  "fixed": "img/icons/marker/circle.svg",
                  "mode": "fixed",
                },
                "showLegend": true,
                "size": Object {
                  "fixed": 5,
                  "max": 15,
                  "min": 2,
                },
              },
              "location": Object {
                "mode": "auto",
              },
              "type": "markers",
            },
          ],
          "view": Object {
            "id": "zero",
            "lat": 0,
            "lon": 0,
            "zoom": 1,
          },
        },
        "pluginVersion": "8.3.0-pre",
        "title": "Panel Title",
        "type": "geomap",
      }
    `);
  });
});
