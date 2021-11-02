import { __makeTemplateObject } from "tslib";
import { FieldConfigProperty, } from '@grafana/data';
import React from 'react';
import { Counter, Field, HorizontalGroup, IconButton, Label, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { OptionsPaneCategory } from './OptionsPaneCategory';
export var DynamicConfigValueEditor = function (_a) {
    var _b;
    var property = _a.property, context = _a.context, registry = _a.registry, onChange = _a.onChange, onRemove = _a.onRemove, isSystemOverride = _a.isSystemOverride;
    var theme = useTheme();
    var styles = getStyles(theme);
    var item = registry === null || registry === void 0 ? void 0 : registry.getIfExists(property.id);
    if (!item) {
        return null;
    }
    var isCollapsible = Array.isArray(property.value) ||
        property.id === FieldConfigProperty.Thresholds ||
        property.id === FieldConfigProperty.Links ||
        property.id === FieldConfigProperty.Mappings;
    var labelCategory = (_b = item.category) === null || _b === void 0 ? void 0 : _b.filter(function (c) { return c !== item.name; });
    var editor;
    // eslint-disable-next-line react/display-name
    var renderLabel = function (includeDescription, includeCounter) {
        if (includeDescription === void 0) { includeDescription = true; }
        if (includeCounter === void 0) { includeCounter = false; }
        return function (isExpanded) {
            if (isExpanded === void 0) { isExpanded = false; }
            return (React.createElement(HorizontalGroup, { justify: "space-between" },
                React.createElement(Label, { category: labelCategory, description: includeDescription ? item.description : undefined },
                    item.name,
                    !isExpanded && includeCounter && item.getItemsCount && React.createElement(Counter, { value: item.getItemsCount(property.value) })),
                !isSystemOverride && (React.createElement("div", null,
                    React.createElement(IconButton, { name: "times", onClick: onRemove })))));
        };
    };
    if (isCollapsible) {
        editor = (React.createElement(OptionsPaneCategory, { id: item.name, renderTitle: renderLabel(false, true), className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          padding-left: 0;\n          padding-right: 0;\n        "], ["\n          padding-left: 0;\n          padding-right: 0;\n        "]))), isNested: true, isOpenDefault: property.value !== undefined },
            React.createElement(item.override, { value: property.value, onChange: function (value) {
                    onChange(value);
                }, item: item, context: context })));
    }
    else {
        editor = (React.createElement("div", null,
            React.createElement(Field, { label: renderLabel()(), description: item.description },
                React.createElement(item.override, { value: property.value, onChange: function (value) {
                        onChange(value);
                    }, item: item, context: context }))));
    }
    return (React.createElement("div", { className: cx(isCollapsible && styles.collapsibleOverrideEditor, !isCollapsible && 'dynamicConfigValueEditor--nonCollapsible') }, editor));
};
var getStyles = stylesFactory(function (theme) {
    return {
        collapsibleOverrideEditor: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: collapsibleOverrideEditor;\n      & + .dynamicConfigValueEditor--nonCollapsible {\n        margin-top: ", "px;\n      }\n    "], ["\n      label: collapsibleOverrideEditor;\n      & + .dynamicConfigValueEditor--nonCollapsible {\n        margin-top: ", "px;\n      }\n    "])), theme.spacing.formSpacingBase),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=DynamicConfigValueEditor.js.map