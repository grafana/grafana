import { __awaiter, __generator, __values } from "tslib";
import { ReducerID, standardEditorsRegistry, getFieldDisplayName, escapeStringForRegex, VizOrientation, } from '@grafana/data';
export function addStandardDataReduceOptions(builder, includeFieldMatcher) {
    var _this = this;
    if (includeFieldMatcher === void 0) { includeFieldMatcher = true; }
    var valueOptionsCategory = ['Value options'];
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
        showIf: function (options) { return options.reduceOptions.values === true; },
    });
    builder.addCustomEditor({
        id: 'reduceOptions.calcs',
        path: 'reduceOptions.calcs',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        category: valueOptionsCategory,
        editor: standardEditorsRegistry.get('stats-picker').editor,
        defaultValue: [ReducerID.lastNotNull],
        // Hides it when all values mode is on
        showIf: function (currentConfig) { return currentConfig.reduceOptions.values === false; },
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
                getOptions: function (context) { return __awaiter(_this, void 0, void 0, function () {
                    var options, _a, _b, frame, _c, _d, field, name_1, value;
                    var e_1, _e, e_2, _f;
                    return __generator(this, function (_g) {
                        options = [
                            { value: '', label: 'Numeric Fields' },
                            { value: '/.*/', label: 'All Fields' },
                        ];
                        if (context && context.data) {
                            try {
                                for (_a = __values(context.data), _b = _a.next(); !_b.done; _b = _a.next()) {
                                    frame = _b.value;
                                    try {
                                        for (_c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                            field = _d.value;
                                            name_1 = getFieldDisplayName(field, frame, context.data);
                                            value = "/^" + escapeStringForRegex(name_1) + "$/";
                                            options.push({ value: value, label: name_1 });
                                        }
                                    }
                                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                                    finally {
                                        try {
                                            if (_d && !_d.done && (_f = _c.return)) _f.call(_c);
                                        }
                                        finally { if (e_2) throw e_2.error; }
                                    }
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                        }
                        return [2 /*return*/, Promise.resolve(options)];
                    });
                }); },
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
        category: category,
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
//# sourceMappingURL=types.js.map