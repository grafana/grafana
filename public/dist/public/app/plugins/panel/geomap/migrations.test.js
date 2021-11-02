import { mapMigrationHandler, mapPanelChangedHandler } from './migrations';
describe('Worldmap Migrations', function () {
    var prevFieldConfig;
    beforeEach(function () {
        prevFieldConfig = {
            defaults: {},
            overrides: [],
        };
    });
    it('simple worldmap', function () {
        var old = {
            angular: simpleWorldmapConfig,
        };
        var panel = {};
        panel.options = mapPanelChangedHandler(panel, 'grafana-worldmap-panel', old, prevFieldConfig);
        expect(panel).toMatchInlineSnapshot("\n      Object {\n        \"fieldConfig\": Object {\n          \"defaults\": Object {\n            \"decimals\": 3,\n            \"thresholds\": Object {\n              \"mode\": \"absolute\",\n              \"steps\": Array [\n                Object {\n                  \"color\": \"#37872D\",\n                  \"value\": -Infinity,\n                },\n                Object {\n                  \"color\": \"#E0B400\",\n                  \"value\": 0,\n                },\n                Object {\n                  \"color\": \"#C4162A\",\n                  \"value\": 50,\n                },\n                Object {\n                  \"color\": \"#8F3BB8\",\n                  \"value\": 100,\n                },\n              ],\n            },\n          },\n          \"overrides\": Array [],\n        },\n        \"options\": Object {\n          \"basemap\": Object {\n            \"type\": \"default\",\n          },\n          \"controls\": Object {\n            \"mouseWheelZoom\": true,\n            \"showZoom\": true,\n          },\n          \"layers\": Array [],\n          \"view\": Object {\n            \"id\": \"europe\",\n            \"lat\": 46,\n            \"lon\": 14,\n            \"zoom\": 6,\n          },\n        },\n      }\n    ");
    });
});
var simpleWorldmapConfig = {
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
describe('geomap migrations', function () {
    it('updates marker', function () {
        var panel = {
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
        };
        panel.options = mapMigrationHandler(panel);
        expect(panel).toMatchInlineSnapshot("\n      Object {\n        \"datasource\": null,\n        \"fieldConfig\": Object {\n          \"defaults\": Object {\n            \"color\": Object {\n              \"mode\": \"thresholds\",\n            },\n            \"mappings\": Array [],\n            \"thresholds\": Object {\n              \"mode\": \"absolute\",\n              \"steps\": Array [\n                Object {\n                  \"color\": \"green\",\n                  \"value\": null,\n                },\n                Object {\n                  \"color\": \"red\",\n                  \"value\": 80,\n                },\n              ],\n            },\n          },\n          \"overrides\": Array [],\n        },\n        \"gridPos\": Object {\n          \"h\": 9,\n          \"w\": 12,\n          \"x\": 0,\n          \"y\": 0,\n        },\n        \"id\": 2,\n        \"options\": Object {\n          \"basemap\": Object {\n            \"config\": Object {},\n            \"type\": \"default\",\n          },\n          \"controls\": Object {\n            \"mouseWheelZoom\": true,\n            \"showAttribution\": true,\n            \"showDebug\": false,\n            \"showScale\": false,\n            \"showZoom\": true,\n          },\n          \"layers\": Array [\n            Object {\n              \"config\": Object {\n                \"color\": Object {\n                  \"fixed\": \"dark-green\",\n                },\n                \"fillOpacity\": 0.4,\n                \"markerSymbol\": Object {\n                  \"fixed\": \"img/icons/marker/circle.svg\",\n                  \"mode\": \"fixed\",\n                },\n                \"showLegend\": true,\n                \"size\": Object {\n                  \"fixed\": 5,\n                  \"max\": 15,\n                  \"min\": 2,\n                },\n              },\n              \"location\": Object {\n                \"mode\": \"auto\",\n              },\n              \"type\": \"markers\",\n            },\n          ],\n          \"view\": Object {\n            \"id\": \"zero\",\n            \"lat\": 0,\n            \"lon\": 0,\n            \"zoom\": 1,\n          },\n        },\n        \"pluginVersion\": \"8.3.0-pre\",\n        \"title\": \"Panel Title\",\n        \"type\": \"geomap\",\n      }\n    ");
    });
});
//# sourceMappingURL=migrations.test.js.map