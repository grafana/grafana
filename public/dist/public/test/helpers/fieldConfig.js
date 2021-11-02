import { identityOverrideProcessor, ThresholdsMode } from '@grafana/data';
export function mockStandardFieldConfigOptions() {
    var category = ['Standard options'];
    var unit = {
        category: category,
        id: 'unit',
        path: 'unit',
        name: 'Unit',
        description: 'Value units',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var decimals = {
        category: category,
        id: 'decimals',
        path: 'decimals',
        name: 'Decimals',
        description: 'Number of decimal to be shown for a value',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var boolean = {
        category: category,
        id: 'boolean',
        path: 'boolean',
        name: 'Boolean',
        description: '',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var fieldColor = {
        category: category,
        id: 'color',
        path: 'color',
        name: 'color',
        description: '',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var text = {
        category: category,
        id: 'text',
        path: 'text',
        name: 'text',
        description: '',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var number = {
        category: category,
        id: 'number',
        path: 'number',
        name: 'number',
        description: '',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
    };
    var thresholds = {
        category: ['Thresholds'],
        id: 'thresholds',
        path: 'thresholds',
        name: 'thresholds',
        description: '',
        // @ts-ignore
        editor: function () { return null; },
        // @ts-ignore
        override: function () { return null; },
        process: identityOverrideProcessor,
        shouldApply: function () { return true; },
        defaultValue: {
            mode: ThresholdsMode.Absolute,
            steps: [
                { value: -Infinity, color: 'green' },
                { value: 80, color: 'red' },
            ],
        },
    };
    return [unit, decimals, boolean, fieldColor, text, number, thresholds];
}
//# sourceMappingURL=fieldConfig.js.map