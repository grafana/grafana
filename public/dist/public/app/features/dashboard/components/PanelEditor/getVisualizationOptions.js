import { get as lodashGet } from 'lodash';
import React from 'react';
import { isNestedPanelOptions, PanelOptionsEditorBuilder, } from '@grafana/data/src/utils/OptionsUIBuilders';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { getOptionOverrides } from './state/getOptionOverrides';
import { setOptionImmutably, updateDefaultFieldConfigValue } from './utils';
export function getStandardEditorContext({ data, replaceVariables, options, eventBus, instanceState, }) {
    var _a;
    const dataSeries = (_a = data === null || data === void 0 ? void 0 : data.series) !== null && _a !== void 0 ? _a : [];
    const context = {
        data: dataSeries,
        replaceVariables,
        options,
        eventBus,
        getSuggestions: (scope) => getDataLinksVariableSuggestions(dataSeries, scope),
        instanceState,
    };
    return context;
}
export function getVisualizationOptions(props) {
    const { plugin, panel, onPanelOptionsChanged, onFieldConfigsChange, data, dashboard, instanceState } = props;
    const currentOptions = panel.getOptions();
    const currentFieldConfig = panel.fieldConfig;
    const categoryIndex = {};
    const context = getStandardEditorContext({
        data,
        replaceVariables: panel.replaceVariables,
        options: currentOptions,
        eventBus: dashboard.events,
        instanceState,
    });
    const getOptionsPaneCategory = (categoryNames) => {
        var _a;
        const categoryName = (_a = (categoryNames && categoryNames[0])) !== null && _a !== void 0 ? _a : `${plugin.meta.name}`;
        const category = categoryIndex[categoryName];
        if (category) {
            return category;
        }
        return (categoryIndex[categoryName] = new OptionsPaneCategoryDescriptor({
            title: categoryName,
            id: categoryName,
            sandboxId: plugin.meta.id,
        }));
    };
    const access = {
        getValue: (path) => lodashGet(currentOptions, path),
        onChange: (path, value) => {
            const newOptions = setOptionImmutably(currentOptions, path, value);
            onPanelOptionsChanged(newOptions);
        },
    };
    // Load the options into categories
    fillOptionsPaneItems(plugin.getPanelOptionsSupplier(), access, getOptionsPaneCategory, context);
    /**
     * Field options
     */
    for (const fieldOption of plugin.fieldConfigRegistry.list()) {
        if (fieldOption.isCustom) {
            if (fieldOption.showIf && !fieldOption.showIf(currentFieldConfig.defaults.custom, data === null || data === void 0 ? void 0 : data.series)) {
                continue;
            }
        }
        else {
            if (fieldOption.showIf && !fieldOption.showIf(currentFieldConfig.defaults, data === null || data === void 0 ? void 0 : data.series)) {
                continue;
            }
        }
        if (fieldOption.hideFromDefaults) {
            continue;
        }
        const category = getOptionsPaneCategory(fieldOption.category);
        const Editor = fieldOption.editor;
        const defaults = currentFieldConfig.defaults;
        const value = fieldOption.isCustom
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
            overrides: getOptionOverrides(fieldOption, currentFieldConfig, data === null || data === void 0 ? void 0 : data.series),
            render: function renderEditor() {
                const onChange = (v) => {
                    onFieldConfigsChange(updateDefaultFieldConfigValue(currentFieldConfig, fieldOption.path, v, fieldOption.isCustom));
                };
                return React.createElement(Editor, { value: value, onChange: onChange, item: fieldOption, context: context, id: fieldOption.id });
            },
        }));
    }
    return Object.values(categoryIndex);
}
/**
 * This will iterate all options panes and add register them with the configured categories
 *
 * @internal
 */
export function fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context, parentCategory) {
    var _a, _b;
    const builder = new PanelOptionsEditorBuilder();
    supplier(builder, context);
    for (const pluginOption of builder.getItems()) {
        if (pluginOption.showIf && !pluginOption.showIf(context.options, context.data)) {
            continue;
        }
        let category = parentCategory;
        if (!category) {
            category = getOptionsPaneCategory(pluginOption.category);
        }
        else if ((_b = (_a = pluginOption.category) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.length) {
            category = category.getCategory(pluginOption.category[0]);
        }
        // Nested options get passed up one level
        if (isNestedPanelOptions(pluginOption)) {
            const subAccess = pluginOption.getNestedValueAccess(access);
            const subContext = subAccess.getContext
                ? subAccess.getContext(context)
                : Object.assign(Object.assign({}, context), { options: access.getValue(pluginOption.path) });
            fillOptionsPaneItems(pluginOption.getBuilder(), subAccess, getOptionsPaneCategory, subContext, category // parent category
            );
            continue;
        }
        const Editor = pluginOption.editor;
        category.addItem(new OptionsPaneItemDescriptor({
            title: pluginOption.name,
            description: pluginOption.description,
            render: function renderEditor() {
                return (React.createElement(Editor, { value: access.getValue(pluginOption.path), onChange: (value) => {
                        access.onChange(pluginOption.path, value);
                    }, item: pluginOption, context: context, id: pluginOption.id }));
            },
        }));
    }
}
//# sourceMappingURL=getVisualizationOptions.js.map