import { FieldColorModeId, FieldConfigProperty, standardEditorsRegistry, standardFieldConfigEditorRegistry, ThresholdsMode, } from '@grafana/data';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
import { mockStandardFieldConfigOptions } from 'test/helpers/fieldConfig';
import { getPanelOptionsWithDefaults, restoreCustomOverrideRules } from './getPanelOptionsWithDefaults';
standardFieldConfigEditorRegistry.setInit(function () { return mockStandardFieldConfigOptions(); });
standardEditorsRegistry.setInit(function () { return mockStandardFieldConfigOptions(); });
var pluginA = getPanelPlugin({ id: 'graph' });
pluginA.useFieldConfig({
    useCustomConfig: function (builder) {
        builder.addBooleanSwitch({
            name: 'Hide lines',
            path: 'hideLines',
            defaultValue: false,
        });
    },
});
pluginA.setPanelOptions(function (builder) {
    builder.addBooleanSwitch({
        name: 'Show thresholds',
        path: 'showThresholds',
        defaultValue: true,
    });
    builder.addTextInput({
        name: 'Name',
        path: 'name',
        defaultValue: 'hello',
    });
    builder.addNumberInput({
        name: 'Number',
        path: 'number',
        defaultValue: 10,
    });
});
describe('getPanelOptionsWithDefaults', function () {
    describe('When panel plugin has no options', function () {
        it('Should set defaults', function () {
            var result = runScenario({
                plugin: getPanelPlugin({ id: 'graph' }),
                options: {},
                defaults: {},
                overrides: [],
            });
            expect(result).toMatchInlineSnapshot("\n        Object {\n          \"fieldConfig\": Object {\n            \"defaults\": Object {},\n            \"overrides\": Array [],\n          },\n          \"options\": Object {},\n        }\n      ");
        });
    });
    describe('When current options are emtpy', function () {
        it('Should set defaults', function () {
            var result = getPanelOptionsWithDefaults({
                plugin: pluginA,
                currentOptions: {},
                currentFieldConfig: {
                    defaults: {},
                    overrides: [],
                },
                isAfterPluginChange: false,
            });
            expect(result).toMatchInlineSnapshot("\n        Object {\n          \"fieldConfig\": Object {\n            \"defaults\": Object {\n              \"custom\": Object {\n                \"hideLines\": false,\n              },\n              \"thresholds\": Object {\n                \"mode\": \"absolute\",\n                \"steps\": Array [\n                  Object {\n                    \"color\": \"green\",\n                    \"value\": -Infinity,\n                  },\n                  Object {\n                    \"color\": \"red\",\n                    \"value\": 80,\n                  },\n                ],\n              },\n            },\n            \"overrides\": Array [],\n          },\n          \"options\": Object {\n            \"name\": \"hello\",\n            \"number\": 10,\n            \"showThresholds\": true,\n          },\n        }\n      ");
        });
    });
    describe('When there are current options and overrides', function () {
        it('Should set defaults', function () {
            var result = getPanelOptionsWithDefaults({
                plugin: pluginA,
                currentOptions: {
                    number: 20,
                    showThresholds: false,
                },
                currentFieldConfig: {
                    defaults: {
                        unit: 'bytes',
                        decimals: 2,
                    },
                    overrides: [],
                },
                isAfterPluginChange: true,
            });
            expect(result).toMatchInlineSnapshot("\n        Object {\n          \"fieldConfig\": Object {\n            \"defaults\": Object {\n              \"custom\": Object {\n                \"hideLines\": false,\n              },\n              \"decimals\": 2,\n              \"thresholds\": Object {\n                \"mode\": \"absolute\",\n                \"steps\": Array [\n                  Object {\n                    \"color\": \"green\",\n                    \"value\": -Infinity,\n                  },\n                  Object {\n                    \"color\": \"red\",\n                    \"value\": 80,\n                  },\n                ],\n              },\n              \"unit\": \"bytes\",\n            },\n            \"overrides\": Array [],\n          },\n          \"options\": Object {\n            \"name\": \"hello\",\n            \"number\": 20,\n            \"showThresholds\": false,\n          },\n        }\n      ");
        });
    });
    describe('when changing panel type to one that does not support by value color mode', function () {
        it('should change color mode', function () {
            var _a;
            var plugin = getPanelPlugin({ id: 'graph' }).useFieldConfig({
                standardOptions: (_a = {},
                    _a[FieldConfigProperty.Color] = {
                        settings: {
                            byValueSupport: false,
                        },
                    },
                    _a),
            });
            var result = getPanelOptionsWithDefaults({
                plugin: plugin,
                currentOptions: {},
                currentFieldConfig: {
                    defaults: {
                        color: { mode: FieldColorModeId.Thresholds },
                    },
                    overrides: [],
                },
                isAfterPluginChange: true,
            });
            expect(result.fieldConfig.defaults.color.mode).toBe(FieldColorModeId.PaletteClassic);
        });
    });
    describe('when changing panel type from one not supporting by value color mode to one that supports it', function () {
        it('should keep supported mode', function () {
            var _a;
            var result = runScenario({
                defaults: {
                    color: { mode: FieldColorModeId.PaletteClassic },
                },
                standardOptions: (_a = {},
                    _a[FieldConfigProperty.Color] = {
                        settings: {
                            byValueSupport: true,
                        },
                    },
                    _a),
            });
            expect(result.fieldConfig.defaults.color.mode).toBe(FieldColorModeId.PaletteClassic);
        });
        it('should change to thresholds mode when it prefers to', function () {
            var _a;
            var result = runScenario({
                defaults: {
                    color: { mode: FieldColorModeId.PaletteClassic },
                },
                standardOptions: (_a = {},
                    _a[FieldConfigProperty.Color] = {
                        settings: {
                            byValueSupport: true,
                            preferThresholdsMode: true,
                        },
                    },
                    _a),
                isAfterPluginChange: true,
            });
            expect(result.fieldConfig.defaults.color.mode).toBe(FieldColorModeId.Thresholds);
        });
        it('should change to classic mode when panel supports bySeries', function () {
            var _a;
            var result = runScenario({
                defaults: {
                    color: { mode: FieldColorModeId.Thresholds },
                },
                standardOptions: (_a = {},
                    _a[FieldConfigProperty.Color] = {
                        settings: {
                            byValueSupport: true,
                            bySeriesSupport: true,
                        },
                    },
                    _a),
                isAfterPluginChange: true,
            });
            expect(result.fieldConfig.defaults.color.mode).toBe(FieldColorModeId.PaletteClassic);
        });
    });
    describe('when changing panel type to one that does not use standard field config', function () {
        it('should clean defaults', function () {
            var plugin = getPanelPlugin({ id: 'graph' });
            var result = getPanelOptionsWithDefaults({
                plugin: plugin,
                currentOptions: {},
                currentFieldConfig: {
                    defaults: {
                        color: { mode: FieldColorModeId.Thresholds },
                        thresholds: {
                            mode: ThresholdsMode.Absolute,
                            steps: [],
                        },
                    },
                    overrides: [],
                },
                isAfterPluginChange: true,
            });
            expect(result.fieldConfig.defaults.thresholds).toBeUndefined();
        });
    });
    describe('when applying defaults clean properties that are no longer part of the registry', function () {
        it('should remove custom defaults that no longer exist', function () {
            var result = runScenario({
                defaults: {
                    unit: 'bytes',
                    custom: {
                        customProp: 20,
                        customPropNoExist: true,
                        nested: {
                            nestedA: 'A',
                            nestedB: 'B',
                        },
                    },
                },
            });
            expect(result.fieldConfig.defaults).toMatchInlineSnapshot("\n        Object {\n          \"custom\": Object {\n            \"customProp\": 20,\n            \"nested\": Object {\n              \"nestedA\": \"A\",\n            },\n          },\n          \"thresholds\": Object {\n            \"mode\": \"absolute\",\n            \"steps\": Array [\n              Object {\n                \"color\": \"green\",\n                \"value\": -Infinity,\n              },\n              Object {\n                \"color\": \"red\",\n                \"value\": 80,\n              },\n            ],\n          },\n          \"unit\": \"bytes\",\n        }\n      ");
        });
        it('should remove custom overrides that no longer exist', function () {
            var result = runScenario({
                defaults: {},
                overrides: [
                    {
                        matcher: { id: 'byName', options: 'D-series' },
                        properties: [
                            {
                                id: 'custom.customPropNoExist',
                                value: 'google',
                            },
                        ],
                    },
                    {
                        matcher: { id: 'byName', options: 'D-series' },
                        properties: [
                            {
                                id: 'custom.customProp',
                                value: 30,
                            },
                        ],
                    },
                ],
            });
            expect(result.fieldConfig.overrides.length).toBe(1);
            expect(result.fieldConfig.overrides[0].properties[0].id).toBe('custom.customProp');
        });
    });
});
describe('restoreCustomOverrideRules', function () {
    it('should add back custom rules', function () {
        var current = {
            defaults: {},
            overrides: [
                {
                    matcher: { id: 'byName', options: 'SeriesA' },
                    properties: [
                        {
                            id: 'decimals',
                            value: 2,
                        },
                    ],
                },
            ],
        };
        var old = {
            defaults: {},
            overrides: [
                {
                    matcher: { id: 'byName', options: 'SeriesA' },
                    properties: [
                        {
                            id: 'custom.propName',
                            value: 10,
                        },
                    ],
                },
                {
                    matcher: { id: 'byName', options: 'SeriesB' },
                    properties: [
                        {
                            id: 'custom.propName',
                            value: 20,
                        },
                    ],
                },
            ],
        };
        var result = restoreCustomOverrideRules(current, old);
        expect(result.overrides.length).toBe(2);
        expect(result.overrides[0].properties[0].id).toBe('decimals');
        expect(result.overrides[0].properties[1].id).toBe('custom.propName');
        expect(result.overrides[1].properties.length).toBe(1);
        expect(result.overrides[1].matcher.options).toBe('SeriesB');
    });
});
function runScenario(options) {
    var _a;
    var fieldConfig = {
        defaults: options.defaults || {},
        overrides: options.overrides || [],
    };
    var plugin = (_a = options.plugin) !== null && _a !== void 0 ? _a : getPanelPlugin({ id: 'graph' }).useFieldConfig({
        standardOptions: options.standardOptions,
        useCustomConfig: function (builder) {
            builder.addNumberInput({
                name: 'Custom prop',
                path: 'customProp',
                defaultValue: 10,
            });
            builder.addTextInput({
                name: 'Nested prop',
                path: 'nested.nestedA',
            });
        },
    });
    return getPanelOptionsWithDefaults({
        plugin: plugin,
        currentOptions: options.options || {},
        currentFieldConfig: fieldConfig,
        isAfterPluginChange: !!options.isAfterPluginChange,
    });
}
//# sourceMappingURL=getPanelOptionsWithDefaults.test.js.map