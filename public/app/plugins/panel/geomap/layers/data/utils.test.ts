import { PanelModel, FieldConfigSource } from '@grafana/data';
import { dataFrameToPoints } from './utils';
import { Point } from 'ol/geom';

import _ from 'lodash';

describe('Format DataFrame into Points', () => {
  let points: Point[] = [];

  describe('when latitude and longitude are given in data and query type is coordinates', () => {
    beforeEach(() => {
      const config = {
        queryFormat: {
          locationType: 'coordinates',
        },
        fieldMapping: {
          latitudeField: 'latitude',
          longitudeField: 'longitude',
        }
      };
      dataFormatter = new DataFormatter(ctrl);
    });

    it('should use latitude and longitude coordinates', () => {
      const data = [
        [
          {
            latitude: 1,
            longitude: 2
          },
          {
            latitude: 3,
            longitude: 4
          }
        ]
      ];
      const data: any[] = [];

      dataFormatter.setTableValues(tableData, data);

      expect(data[0].locationLatitude).toEqual(1);
      expect(data[0].locationLongitude).toEqual(2);
      expect(data[1].locationLatitude).toEqual(3);
      expect(data[1].locationLongitude).toEqual(4);
    });
  });

  describe('when geohash in table data and query type is geohash', () => {
    beforeEach(() => {
      const ctrl = {
        panel: {
          tableQueryOptions: {
            queryType: 'geohash',
            geohashField: 'geohash',
          }
        }
      };
      dataFormatter = new DataFormatter(ctrl);
    });

    it('should use the geohash field for the query', () => {
      const tableData = [
        [
          {
            latitude: 1,
            longitude: 2,
            geohash: 'stq4s3x' // 29.9796, 31.1345
          },
          {
            latitude: 3,
            longitude: 4,
            geohash: 'p05010r' // -89.997, 139.273
          }
        ]
      ];
      const data: any[] = [];

      dataFormatter.setTableValues(tableData, data);

      expect(data[0].locationLatitude).toBeCloseTo(29.9796);
      expect(data[0].locationLongitude).toBeCloseTo(31.1345);
      expect(data[1].locationLatitude).toBeCloseTo(-89.998);
      expect(data[1].locationLongitude).toBeCloseTo(139.272);
    });
  });

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
            "showLegend": true,
            "showZoom": true,
          },
          "layers": Array [],
          "view": Object {
            "center": Object {
              "id": "europe",
              "lat": 46,
              "lon": 14,
            },
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
