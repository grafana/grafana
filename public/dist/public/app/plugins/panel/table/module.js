import { __awaiter } from "tslib";
import { FieldType, getFieldDisplayName, PanelPlugin, ReducerID, standardEditorsRegistry, identityOverrideProcessor, } from '@grafana/data';
import { TableCellDisplayMode, defaultTableFieldOptions, TableCellHeight } from '@grafana/schema';
import { PaginationEditor } from './PaginationEditor';
import { TableCellOptionEditor } from './TableCellOptionEditor';
import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { defaultOptions } from './panelcfg.gen';
import { TableSuggestionsSupplier } from './suggestions';
const footerCategory = 'Table footer';
const cellCategory = ['Cell options'];
export const plugin = new PanelPlugin(TablePanel)
    .setPanelChangeHandler(tablePanelChangedHandler)
    .setMigrationHandler(tableMigrationHandler)
    .useFieldConfig({
    useCustomConfig: (builder) => {
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
            shouldApply: () => true,
            defaultValue: defaultTableFieldOptions.minWidth,
        })
            .addNumberInput({
            path: 'width',
            name: 'Column width',
            settings: {
                placeholder: 'auto',
                min: 20,
                max: 300,
            },
            shouldApply: () => true,
            defaultValue: defaultTableFieldOptions.width,
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
            defaultValue: defaultTableFieldOptions.align,
        })
            .addCustomEditor({
            id: 'cellOptions',
            path: 'cellOptions',
            name: 'Cell type',
            editor: TableCellOptionEditor,
            override: TableCellOptionEditor,
            defaultValue: defaultTableFieldOptions.cellOptions,
            process: identityOverrideProcessor,
            category: cellCategory,
            shouldApply: () => true,
        })
            .addBooleanSwitch({
            path: 'inspect',
            name: 'Cell value inspect',
            description: 'Enable cell value inspection in a modal window',
            defaultValue: false,
            category: cellCategory,
            showIf: (cfg) => {
                return (cfg.cellOptions.type === TableCellDisplayMode.Auto ||
                    cfg.cellOptions.type === TableCellDisplayMode.JSONView ||
                    cfg.cellOptions.type === TableCellDisplayMode.ColorText ||
                    cfg.cellOptions.type === TableCellDisplayMode.ColorBackground);
            },
        })
            .addBooleanSwitch({
            path: 'filterable',
            name: 'Column filter',
            description: 'Enables/disables field filters in table',
            defaultValue: defaultTableFieldOptions.filterable,
        })
            .addBooleanSwitch({
            path: 'hidden',
            name: 'Hide in table',
            defaultValue: undefined,
            hideFromDefaults: true,
        });
    },
})
    .setPanelOptions((builder) => {
    var _a, _b;
    builder
        .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show table header',
        defaultValue: defaultOptions.showHeader,
    })
        .addRadio({
        path: 'cellHeight',
        name: 'Cell height',
        defaultValue: defaultOptions.cellHeight,
        settings: {
            options: [
                { value: TableCellHeight.Sm, label: 'Small' },
                { value: TableCellHeight.Md, label: 'Medium' },
                { value: TableCellHeight.Lg, label: 'Large' },
            ],
        },
    })
        .addBooleanSwitch({
        path: 'footer.show',
        category: [footerCategory],
        name: 'Show table footer',
        defaultValue: (_a = defaultOptions.footer) === null || _a === void 0 ? void 0 : _a.show,
    })
        .addCustomEditor({
        id: 'footer.reducer',
        category: [footerCategory],
        path: 'footer.reducer',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        editor: standardEditorsRegistry.get('stats-picker').editor,
        defaultValue: [ReducerID.sum],
        showIf: (cfg) => { var _a; return (_a = cfg.footer) === null || _a === void 0 ? void 0 : _a.show; },
    })
        .addBooleanSwitch({
        path: 'footer.countRows',
        category: [footerCategory],
        name: 'Count rows',
        description: 'Display a single count for all data rows',
        defaultValue: (_b = defaultOptions.footer) === null || _b === void 0 ? void 0 : _b.countRows,
        showIf: (cfg) => { var _a, _b, _c; return ((_b = (_a = cfg.footer) === null || _a === void 0 ? void 0 : _a.reducer) === null || _b === void 0 ? void 0 : _b.length) === 1 && ((_c = cfg.footer) === null || _c === void 0 ? void 0 : _c.reducer[0]) === ReducerID.count; },
    })
        .addMultiSelect({
        path: 'footer.fields',
        category: [footerCategory],
        name: 'Fields',
        description: 'Select the fields that should be calculated',
        settings: {
            allowCustomValue: false,
            options: [],
            placeholder: 'All Numeric Fields',
            getOptions: (context) => __awaiter(void 0, void 0, void 0, function* () {
                const options = [];
                if (context && context.data && context.data.length > 0) {
                    const frame = context.data[0];
                    for (const field of frame.fields) {
                        if (field.type === FieldType.number) {
                            const name = getFieldDisplayName(field, frame, context.data);
                            const value = field.name;
                            options.push({ value, label: name });
                        }
                    }
                }
                return options;
            }),
        },
        defaultValue: '',
        showIf: (cfg) => {
            var _a, _b, _c, _d, _e;
            return (((_a = cfg.footer) === null || _a === void 0 ? void 0 : _a.show) && !((_b = cfg.footer) === null || _b === void 0 ? void 0 : _b.countRows)) ||
                (((_d = (_c = cfg.footer) === null || _c === void 0 ? void 0 : _c.reducer) === null || _d === void 0 ? void 0 : _d.length) === 1 && ((_e = cfg.footer) === null || _e === void 0 ? void 0 : _e.reducer[0]) !== ReducerID.count);
        },
    })
        .addCustomEditor({
        id: 'footer.enablePagination',
        path: 'footer.enablePagination',
        name: 'Enable pagination',
        editor: PaginationEditor,
    });
})
    .setSuggestionsSupplier(new TableSuggestionsSupplier());
//# sourceMappingURL=module.js.map