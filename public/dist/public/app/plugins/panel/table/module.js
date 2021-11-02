import { __awaiter, __generator, __values } from "tslib";
import { FieldType, getFieldDisplayName, PanelPlugin, ReducerID, standardEditorsRegistry, } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { defaultPanelOptions, defaultPanelFieldConfig } from './models.gen';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { TableCellDisplayMode } from '@grafana/ui';
import { TableSuggestionsSupplier } from './suggestions';
export var plugin = new PanelPlugin(TablePanel)
    .setPanelChangeHandler(tablePanelChangedHandler)
    .setMigrationHandler(tableMigrationHandler)
    .setNoPadding()
    .useFieldConfig({
    useCustomConfig: function (builder) {
        builder
            .addNumberInput({
            path: 'minWidth',
            name: 'Minimum column width',
            description: 'The minimum width for column auto resizing',
            settings: {
                placeholder: '150',
                min: 50,
                max: 500,
            },
            shouldApply: function () { return true; },
            defaultValue: defaultPanelFieldConfig.minWidth,
        })
            .addNumberInput({
            path: 'width',
            name: 'Column width',
            settings: {
                placeholder: 'auto',
                min: 20,
                max: 300,
            },
            shouldApply: function () { return true; },
            defaultValue: defaultPanelFieldConfig.width,
        })
            .addRadio({
            path: 'align',
            name: 'Column alignment',
            settings: {
                options: [
                    { label: 'auto', value: 'auto' },
                    { label: 'left', value: 'left' },
                    { label: 'center', value: 'center' },
                    { label: 'right', value: 'right' },
                ],
            },
            defaultValue: defaultPanelFieldConfig.align,
        })
            .addSelect({
            path: 'displayMode',
            name: 'Cell display mode',
            description: 'Color text, background, show as gauge, etc',
            settings: {
                options: [
                    { value: TableCellDisplayMode.Auto, label: 'Auto' },
                    { value: TableCellDisplayMode.ColorText, label: 'Color text' },
                    { value: TableCellDisplayMode.ColorBackground, label: 'Color background (gradient)' },
                    { value: TableCellDisplayMode.ColorBackgroundSolid, label: 'Color background (solid)' },
                    { value: TableCellDisplayMode.GradientGauge, label: 'Gradient gauge' },
                    { value: TableCellDisplayMode.LcdGauge, label: 'LCD gauge' },
                    { value: TableCellDisplayMode.BasicGauge, label: 'Basic gauge' },
                    { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
                    { value: TableCellDisplayMode.Image, label: 'Image' },
                ],
            },
            defaultValue: defaultPanelFieldConfig.displayMode,
        })
            .addBooleanSwitch({
            path: 'filterable',
            name: 'Column filter',
            description: 'Enables/disables field filters in table',
            defaultValue: defaultPanelFieldConfig.filterable,
        });
    },
})
    .setPanelOptions(function (builder) {
    var _a;
    builder
        .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show header',
        description: "To display table's header or not to display",
        defaultValue: defaultPanelOptions.showHeader,
    })
        .addBooleanSwitch({
        path: 'footer.show',
        name: 'Show Footer',
        description: "To display table's footer or not to display",
        defaultValue: (_a = defaultPanelOptions.footer) === null || _a === void 0 ? void 0 : _a.show,
    })
        .addCustomEditor({
        id: 'footer.reducer',
        path: 'footer.reducer',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        editor: standardEditorsRegistry.get('stats-picker').editor,
        defaultValue: [ReducerID.sum],
        showIf: function (cfg) { var _a; return (_a = cfg.footer) === null || _a === void 0 ? void 0 : _a.show; },
    })
        .addMultiSelect({
        path: 'footer.fields',
        name: 'Fields',
        description: 'Select the fields that should be calculated',
        settings: {
            allowCustomValue: false,
            options: [],
            placeholder: 'All Numeric Fields',
            getOptions: function (context) { return __awaiter(void 0, void 0, void 0, function () {
                var options, frame, _a, _b, field, name_1, value;
                var e_1, _c;
                return __generator(this, function (_d) {
                    options = [];
                    if (context && context.data && context.data.length > 0) {
                        frame = context.data[0];
                        try {
                            for (_a = __values(frame.fields), _b = _a.next(); !_b.done; _b = _a.next()) {
                                field = _b.value;
                                if (field.type === FieldType.number) {
                                    name_1 = getFieldDisplayName(field, frame, context.data);
                                    value = field.name;
                                    options.push({ value: value, label: name_1 });
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    return [2 /*return*/, options];
                });
            }); },
        },
        defaultValue: '',
        showIf: function (cfg) { var _a; return (_a = cfg.footer) === null || _a === void 0 ? void 0 : _a.show; },
    });
})
    .setSuggestionsSupplier(new TableSuggestionsSupplier());
//# sourceMappingURL=module.js.map