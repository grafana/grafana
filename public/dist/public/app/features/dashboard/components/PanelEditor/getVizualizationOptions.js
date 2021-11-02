import { __assign, __values } from "tslib";
import React from 'react';
import { get as lodashGet } from 'lodash';
import { getDataLinksVariableSuggestions } from 'app/angular/panel/panellinks/link_srv';
import { updateDefaultFieldConfigValue, setOptionImmutably } from './utils';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { isNestedPanelOptions, PanelOptionsEditorBuilder, } from '../../../../../../packages/grafana-data/src/utils/OptionsUIBuilders';
export function getVizualizationOptions(props) {
    var e_1, _a;
    var plugin = props.plugin, panel = props.panel, onPanelOptionsChanged = props.onPanelOptionsChanged, onFieldConfigsChange = props.onFieldConfigsChange, data = props.data, dashboard = props.dashboard, instanceState = props.instanceState;
    var currentOptions = panel.getOptions();
    var currentFieldConfig = panel.fieldConfig;
    var categoryIndex = {};
    var context = {
        data: (data === null || data === void 0 ? void 0 : data.series) || [],
        replaceVariables: panel.replaceVariables,
        options: currentOptions,
        eventBus: dashboard.events,
        getSuggestions: function (scope) {
            return data ? getDataLinksVariableSuggestions(data.series, scope) : [];
        },
        instanceState: instanceState,
    };
    var getOptionsPaneCategory = function (categoryNames) {
        var _a;
        var categoryName = (_a = (categoryNames && categoryNames[0])) !== null && _a !== void 0 ? _a : "" + plugin.meta.name;
        var category = categoryIndex[categoryName];
        if (category) {
            return category;
        }
        return (categoryIndex[categoryName] = new OptionsPaneCategoryDescriptor({
            title: categoryName,
            id: categoryName,
        }));
    };
    var access = {
        getValue: function (path) { return lodashGet(currentOptions, path); },
        onChange: function (path, value) {
            var newOptions = setOptionImmutably(currentOptions, path, value);
            onPanelOptionsChanged(newOptions);
        },
    };
    // Load the options into categories
    fillOptionsPaneItems(plugin.getPanelOptionsSupplier(), access, getOptionsPaneCategory, context);
    var _loop_1 = function (fieldOption) {
        if (fieldOption.isCustom &&
            fieldOption.showIf &&
            !fieldOption.showIf(currentFieldConfig.defaults.custom, data === null || data === void 0 ? void 0 : data.series)) {
            return "continue";
        }
        if (fieldOption.hideFromDefaults) {
            return "continue";
        }
        var category = getOptionsPaneCategory(fieldOption.category);
        var Editor = fieldOption.editor;
        var defaults = currentFieldConfig.defaults;
        var value = fieldOption.isCustom
            ? defaults.custom
                ? lodashGet(defaults.custom, fieldOption.path)
                : undefined
            : lodashGet(defaults, fieldOption.path);
        if (fieldOption.getItemsCount) {
            category.props.itemsCount = fieldOption.getItemsCount(value);
        }
        category.addItem(new OptionsPaneItemDescriptor({
            title: fieldOption.name,
            description: fieldOption.description,
            render: function renderEditor() {
                var onChange = function (v) {
                    onFieldConfigsChange(updateDefaultFieldConfigValue(currentFieldConfig, fieldOption.path, v, fieldOption.isCustom));
                };
                return React.createElement(Editor, { value: value, onChange: onChange, item: fieldOption, context: context, id: fieldOption.id });
            },
        }));
    };
    try {
        /**
         * Field options
         */
        for (var _b = __values(plugin.fieldConfigRegistry.list()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var fieldOption = _c.value;
            _loop_1(fieldOption);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return Object.values(categoryIndex);
}
/**
 * This will iterate all options panes and add register them with the configured categories
 *
 * @internal
 */
export function fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context, parentCategory) {
    var e_2, _a;
    var _b, _c;
    var builder = new PanelOptionsEditorBuilder();
    supplier(builder, context);
    var _loop_2 = function (pluginOption) {
        if (pluginOption.showIf && !pluginOption.showIf(context.options, context.data)) {
            return "continue";
        }
        var category = parentCategory;
        if (!category) {
            category = getOptionsPaneCategory(pluginOption.category);
        }
        else if ((_c = (_b = pluginOption.category) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.length) {
            category = category.getCategory(pluginOption.category[0]);
        }
        // Nested options get passed up one level
        if (isNestedPanelOptions(pluginOption)) {
            var subAccess = pluginOption.getNestedValueAccess(access);
            var subContext = subAccess.getContext
                ? subAccess.getContext(context)
                : __assign(__assign({}, context), { options: access.getValue(pluginOption.path) });
            fillOptionsPaneItems(pluginOption.getBuilder(), subAccess, getOptionsPaneCategory, subContext, category // parent category
            );
            return "continue";
        }
        var Editor = pluginOption.editor;
        category.addItem(new OptionsPaneItemDescriptor({
            title: pluginOption.name,
            description: pluginOption.description,
            render: function renderEditor() {
                return (React.createElement(Editor, { value: access.getValue(pluginOption.path), onChange: function (value) {
                        access.onChange(pluginOption.path, value);
                    }, item: pluginOption, context: context, id: pluginOption.id }));
            },
        }));
    };
    try {
        for (var _d = __values(builder.getItems()), _e = _d.next(); !_e.done; _e = _d.next()) {
            var pluginOption = _e.value;
            _loop_2(pluginOption);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_2) throw e_2.error; }
    }
}
//# sourceMappingURL=getVizualizationOptions.js.map