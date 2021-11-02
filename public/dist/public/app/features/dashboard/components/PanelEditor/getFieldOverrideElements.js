import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { cloneDeep } from 'lodash';
import { isSystemOverride as isSystemOverrideGuard, } from '@grafana/data';
import { fieldMatchersUI, useStyles2, ValuePicker } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { getDataLinksVariableSuggestions } from 'app/angular/panel/panellinks/link_srv';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';
import { css } from '@emotion/css';
export function getFieldOverrideCategories(props) {
    var _a, _b;
    var categories = [];
    var currentFieldConfig = props.panel.fieldConfig;
    var registry = props.plugin.fieldConfigRegistry;
    var data = (_b = (_a = props.data) === null || _a === void 0 ? void 0 : _a.series) !== null && _b !== void 0 ? _b : [];
    if (registry.isEmpty()) {
        return [];
    }
    var onOverrideChange = function (index, override) {
        var overrides = cloneDeep(currentFieldConfig.overrides);
        overrides[index] = override;
        props.onFieldConfigsChange(__assign(__assign({}, currentFieldConfig), { overrides: overrides }));
    };
    var onOverrideRemove = function (overrideIndex) {
        var overrides = cloneDeep(currentFieldConfig.overrides);
        overrides.splice(overrideIndex, 1);
        props.onFieldConfigsChange(__assign(__assign({}, currentFieldConfig), { overrides: overrides }));
    };
    var onOverrideAdd = function (value) {
        props.onFieldConfigsChange(__assign(__assign({}, currentFieldConfig), { overrides: __spreadArray(__spreadArray([], __read(currentFieldConfig.overrides), false), [
                {
                    matcher: {
                        id: value.value,
                    },
                    properties: [],
                },
            ], false) }));
    };
    var context = {
        data: data,
        getSuggestions: function (scope) { return getDataLinksVariableSuggestions(data, scope); },
        isOverride: true,
    };
    var _loop_1 = function (idx) {
        var override = currentFieldConfig.overrides[idx];
        var overrideName = "Override " + (idx + 1);
        var matcherUi = fieldMatchersUI.get(override.matcher.id);
        var configPropertiesOptions = getOverrideProperties(registry);
        var isSystemOverride = isSystemOverrideGuard(override);
        // A way to force open new override categories
        var forceOpen = override.properties.length === 0 ? 1 : 0;
        var category = new OptionsPaneCategoryDescriptor({
            title: overrideName,
            id: overrideName,
            forceOpen: forceOpen,
            renderTitle: function renderOverrideTitle(isExpanded) {
                return (React.createElement(OverrideCategoryTitle, { override: override, isExpanded: isExpanded, registry: registry, overrideName: overrideName, matcherUi: matcherUi, onOverrideRemove: function () { return onOverrideRemove(idx); } }));
            },
        });
        var onMatcherConfigChange = function (options) {
            override.matcher.options = options;
            onOverrideChange(idx, override);
        };
        var onDynamicConfigValueAdd = function (o, value) {
            var registryItem = registry.get(value.value);
            var propertyConfig = {
                id: registryItem.id,
                value: registryItem.defaultValue,
            };
            if (override.properties) {
                o.properties.push(propertyConfig);
            }
            else {
                o.properties = [propertyConfig];
            }
            onOverrideChange(idx, o);
        };
        /**
         * Add override matcher UI element
         */
        category.addItem(new OptionsPaneItemDescriptor({
            title: matcherUi.name,
            render: function renderMatcherUI() {
                var _a, _b;
                return (React.createElement(matcherUi.component, { matcher: matcherUi.matcher, data: (_b = (_a = props.data) === null || _a === void 0 ? void 0 : _a.series) !== null && _b !== void 0 ? _b : [], options: override.matcher.options, onChange: onMatcherConfigChange }));
            },
        }));
        var _loop_2 = function (propIdx) {
            var property = override.properties[propIdx];
            var registryItemForProperty = registry.getIfExists(property.id);
            if (!registryItemForProperty) {
                return "continue";
            }
            var onPropertyChange = function (value) {
                override.properties[propIdx].value = value;
                onOverrideChange(idx, override);
            };
            var onPropertyRemove = function () {
                override.properties.splice(propIdx, 1);
                onOverrideChange(idx, override);
            };
            /**
             * Add override property item
             */
            category.addItem(new OptionsPaneItemDescriptor({
                title: registryItemForProperty.name,
                skipField: true,
                render: function renderPropertyEditor() {
                    return (React.createElement(DynamicConfigValueEditor, { key: property.id + "/" + propIdx, isSystemOverride: isSystemOverride, onChange: onPropertyChange, onRemove: onPropertyRemove, property: property, registry: registry, context: context }));
                },
            }));
        };
        /**
         * Loop through all override properties
         */
        for (var propIdx = 0; propIdx < override.properties.length; propIdx++) {
            _loop_2(propIdx);
        }
        /**
         * Add button that adds new overrides
         */
        if (!isSystemOverride && override.matcher.options) {
            category.addItem(new OptionsPaneItemDescriptor({
                title: '----------',
                skipField: true,
                render: function renderAddPropertyButton() {
                    return (React.createElement(ValuePicker, { key: "Add override property", label: "Add override property", variant: "secondary", isFullWidth: true, icon: "plus", menuPlacement: "auto", options: configPropertiesOptions, onChange: function (v) { return onDynamicConfigValueAdd(override, v); } }));
                },
            }));
        }
        categories.push(category);
    };
    /**
     * Main loop through all override rules
     */
    for (var idx = 0; idx < currentFieldConfig.overrides.length; idx++) {
        _loop_1(idx);
    }
    categories.push(new OptionsPaneCategoryDescriptor({
        title: 'add button',
        id: 'add button',
        customRender: function renderAddButton() {
            return (React.createElement(AddOverrideButtonContainer, { key: "Add override" },
                React.createElement(ValuePicker, { icon: "plus", label: "Add field override", variant: "secondary", menuPlacement: "auto", isFullWidth: true, size: "md", options: fieldMatchersUI
                        .list()
                        .filter(function (o) { return !o.excludeFromPicker; })
                        .map(function (i) { return ({ label: i.name, value: i.id, description: i.description }); }), onChange: function (value) { return onOverrideAdd(value); } })));
        },
    }));
    return categories;
}
function getOverrideProperties(registry) {
    return registry
        .list()
        .filter(function (o) { return !o.hideFromOverrides; })
        .map(function (item) {
        var label = item.name;
        if (item.category) {
            label = __spreadArray(__spreadArray([], __read(item.category), false), [item.name], false).join(' > ');
        }
        return {
            label: label,
            value: item.id,
            description: item.description,
        };
    });
}
function AddOverrideButtonContainer(_a) {
    var children = _a.children;
    var styles = useStyles2(getBorderTopStyles);
    return React.createElement("div", { className: styles }, children);
}
function getBorderTopStyles(theme) {
    return css({
        borderTop: "1px solid " + theme.colors.border.weak,
        padding: "" + theme.spacing(2),
        display: 'flex',
    });
}
//# sourceMappingURL=getFieldOverrideElements.js.map