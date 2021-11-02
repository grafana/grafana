import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';
describe('BarGauge Panel Migrations', function () {
    it('from 6.2', function () {
        var panel = {
            id: 7,
            links: [],
            options: {
                displayMode: 'lcd',
                fieldOptions: {
                    calcs: ['mean'],
                    defaults: {
                        decimals: null,
                        max: -22,
                        min: 33,
                        unit: 'watt',
                    },
                    mappings: [],
                    override: {},
                    thresholds: [
                        {
                            color: 'green',
                            index: 0,
                            value: -Infinity,
                        },
                        {
                            color: 'orange',
                            index: 1,
                            value: 40,
                        },
                        {
                            color: 'red',
                            index: 2,
                            value: 80,
                        },
                    ],
                    values: false,
                },
                orientation: 'vertical',
            },
            pluginVersion: '6.2.0',
            targets: [],
            title: 'Usage',
            type: 'bargauge',
        };
        var newOptions = barGaugePanelMigrationHandler(panel);
        // should mutate panel model and move field config out of panel.options
        expect(panel.fieldConfig).toMatchInlineSnapshot("\n      Object {\n        \"defaults\": Object {\n          \"color\": Object {\n            \"mode\": \"thresholds\",\n          },\n          \"decimals\": null,\n          \"mappings\": Array [],\n          \"max\": 33,\n          \"min\": -22,\n          \"thresholds\": Object {\n            \"mode\": \"absolute\",\n            \"steps\": Array [\n              Object {\n                \"color\": \"green\",\n                \"index\": 0,\n                \"value\": -Infinity,\n              },\n              Object {\n                \"color\": \"orange\",\n                \"index\": 1,\n                \"value\": 40,\n              },\n              Object {\n                \"color\": \"red\",\n                \"index\": 2,\n                \"value\": 80,\n              },\n            ],\n          },\n          \"unit\": \"watt\",\n        },\n        \"overrides\": Array [],\n      }\n    ");
        // should options options
        expect(newOptions).toMatchInlineSnapshot("\n      Object {\n        \"displayMode\": \"lcd\",\n        \"orientation\": \"vertical\",\n        \"reduceOptions\": Object {\n          \"calcs\": Array [\n            \"mean\",\n          ],\n          \"limit\": undefined,\n          \"values\": false,\n        },\n      }\n    ");
    });
});
//# sourceMappingURL=BarGaugeMigrations.test.js.map