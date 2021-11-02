import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';
describe('Gauge Panel Migrations', function () {
    it('from 6.1.1', function () {
        var panel = {
            datasource: '-- Grafana --',
            gridPos: {
                h: 9,
                w: 12,
                x: 0,
                y: 0,
            },
            id: 2,
            options: {
                maxValue: '50',
                minValue: '-50',
                orientation: 'auto',
                showThresholdLabels: true,
                showThresholdMarkers: true,
                thresholds: [
                    {
                        color: 'green',
                        index: 0,
                        value: -Infinity,
                    },
                    {
                        color: '#EAB839',
                        index: 1,
                        value: -25,
                    },
                    {
                        color: '#6ED0E0',
                        index: 2,
                        value: 0,
                    },
                    {
                        color: 'red',
                        index: 3,
                        value: 25,
                    },
                ],
                valueMappings: [
                    {
                        id: 1,
                        operator: '',
                        value: '',
                        text: 'BIG',
                        type: 2,
                        from: '50',
                        to: '1000',
                    },
                ],
                valueOptions: {
                    decimals: 3,
                    prefix: 'XX',
                    stat: 'last',
                    suffix: 'YY',
                    unit: 'accMS2',
                },
            },
            pluginVersion: '6.1.6',
            targets: [
                {
                    refId: 'A',
                },
                {
                    refId: 'B',
                },
                {
                    refId: 'C',
                },
            ],
            timeFrom: null,
            timeShift: null,
            title: 'Panel Title',
            type: 'gauge',
        };
        var result = gaugePanelMigrationHandler(panel);
        expect(result).toMatchSnapshot();
        // Ignored due to the API change
        //@ts-ignore
        expect(result.reduceOptions.defaults).toBeUndefined();
        // Ignored due to the API change
        //@ts-ignore
        expect(result.reduceOptions.overrides).toBeUndefined();
        expect(panel.fieldConfig).toMatchInlineSnapshot("\n      Object {\n        \"defaults\": Object {\n          \"color\": Object {\n            \"mode\": \"thresholds\",\n          },\n          \"decimals\": 3,\n          \"mappings\": Array [\n            Object {\n              \"from\": \"50\",\n              \"id\": 1,\n              \"operator\": \"\",\n              \"text\": \"BIG\",\n              \"to\": \"1000\",\n              \"type\": 2,\n              \"value\": \"\",\n            },\n          ],\n          \"max\": \"50\",\n          \"min\": \"-50\",\n          \"thresholds\": Object {\n            \"mode\": \"absolute\",\n            \"steps\": Array [\n              Object {\n                \"color\": \"green\",\n                \"index\": 0,\n                \"value\": -Infinity,\n              },\n              Object {\n                \"color\": \"#EAB839\",\n                \"index\": 1,\n                \"value\": -25,\n              },\n              Object {\n                \"color\": \"#6ED0E0\",\n                \"index\": 2,\n                \"value\": 0,\n              },\n              Object {\n                \"color\": \"red\",\n                \"index\": 3,\n                \"value\": 25,\n              },\n            ],\n          },\n          \"unit\": \"accMS2\",\n        },\n        \"overrides\": Array [],\n      }\n    ");
    });
    it('change from angular singlestat to gauge', function () {
        var old = {
            angular: {
                format: 'ms',
                decimals: 7,
                gauge: {
                    maxValue: 150,
                    minValue: -10,
                    show: true,
                    thresholdLabels: true,
                    thresholdMarkers: true,
                },
            },
        };
        var panel = {};
        var newOptions = gaugePanelChangedHandler(panel, 'singlestat', old);
        expect(panel.fieldConfig.defaults.unit).toBe('ms');
        expect(panel.fieldConfig.defaults.min).toBe(-10);
        expect(panel.fieldConfig.defaults.max).toBe(150);
        expect(panel.fieldConfig.defaults.decimals).toBe(7);
        expect(newOptions.showThresholdMarkers).toBe(true);
        expect(newOptions.showThresholdLabels).toBe(true);
    });
});
//# sourceMappingURL=GaugeMigrations.test.js.map