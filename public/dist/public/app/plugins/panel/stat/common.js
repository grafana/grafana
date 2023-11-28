// These are used in some other plugins for some reason
import { __awaiter } from "tslib";
import { escapeStringForRegex, getFieldDisplayName, ReducerID, standardEditorsRegistry, } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';
export function addStandardDataReduceOptions(builder, includeFieldMatcher = true) {
    const valueOptionsCategory = ['Value options'];
    builder.addRadio({
        path: 'reduceOptions.values',
        name: 'Show',
        description: 'Calculate a single value per column or series or show each row',
        settings: {
            options: [
                { value: false, label: 'Calculate' },
                { value: true, label: 'All values' },
            ],
        },
        category: valueOptionsCategory,
        defaultValue: false,
    });
    builder.addNumberInput({
        path: 'reduceOptions.limit',
        name: 'Limit',
        description: 'Max number of rows to display',
        category: valueOptionsCategory,
        settings: {
            placeholder: '25',
            integer: true,
            min: 1,
            max: 5000,
        },
        showIf: (options) => options.reduceOptions.values === true,
    });
    builder.addCustomEditor({
        id: 'reduceOptions.calcs',
        path: 'reduceOptions.calcs',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        category: valueOptionsCategory,
        editor: standardEditorsRegistry.get('stats-picker').editor,
        // TODO: Get ReducerID from generated schema one day?
        defaultValue: [ReducerID.lastNotNull],
        // Hides it when all values mode is on
        showIf: (currentConfig) => currentConfig.reduceOptions.values === false,
    });
    if (includeFieldMatcher) {
        builder.addSelect({
            path: 'reduceOptions.fields',
            name: 'Fields',
            description: 'Select the fields that should be included in the panel',
            category: valueOptionsCategory,
            settings: {
                allowCustomValue: true,
                options: [],
                getOptions: (context) => __awaiter(this, void 0, void 0, function* () {
                    const options = [
                        { value: '', label: 'Numeric Fields' },
                        { value: '/.*/', label: 'All Fields' },
                    ];
                    if (context && context.data) {
                        for (const frame of context.data) {
                            for (const field of frame.fields) {
                                const name = getFieldDisplayName(field, frame, context.data);
                                const value = `/^${escapeStringForRegex(name)}$/`;
                                options.push({ value, label: name });
                            }
                        }
                    }
                    return Promise.resolve(options);
                }),
            },
            defaultValue: '',
        });
    }
}
export function addOrientationOption(builder, category) {
    builder.addRadio({
        path: 'orientation',
        name: 'Orientation',
        description: 'Layout orientation',
        category,
        settings: {
            options: [
                { value: VizOrientation.Auto, label: 'Auto' },
                { value: VizOrientation.Horizontal, label: 'Horizontal' },
                { value: VizOrientation.Vertical, label: 'Vertical' },
            ],
        },
        defaultValue: VizOrientation.Auto,
    });
}
//# sourceMappingURL=common.js.map