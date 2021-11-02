import { __assign } from "tslib";
import { FieldType, identityOverrideProcessor, } from '@grafana/data';
import React from 'react';
import { graphFieldOptions, HorizontalGroup, IconButton, Input, RadioButtonGroup, Tooltip, } from '../..';
import { StackingMode } from '@grafana/schema';
export var StackingEditor = function (_a) {
    var value = _a.value, context = _a.context, onChange = _a.onChange, item = _a.item;
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: (value === null || value === void 0 ? void 0 : value.mode) || StackingMode.None, options: item.settings.options, onChange: function (v) {
                onChange(__assign(__assign({}, value), { mode: v }));
            } }),
        context.isOverride && (value === null || value === void 0 ? void 0 : value.mode) && (value === null || value === void 0 ? void 0 : value.mode) !== StackingMode.None && (React.createElement(Input, { type: "text", placeholder: "Group", suffix: React.createElement(Tooltip, { content: "Name of the stacking group", placement: "top" },
                React.createElement(IconButton, { name: "question-circle" })), defaultValue: value === null || value === void 0 ? void 0 : value.group, onChange: function (v) {
                onChange(__assign(__assign({}, value), { group: v.currentTarget.value.trim() }));
            } }))));
};
export function addStackingConfig(builder, defaultConfig, category) {
    if (category === void 0) { category = ['Graph styles']; }
    builder.addCustomEditor({
        id: 'stacking',
        path: 'stacking',
        name: 'Stack series',
        category: category,
        defaultValue: defaultConfig,
        editor: StackingEditor,
        override: StackingEditor,
        settings: {
            options: graphFieldOptions.stacking,
        },
        process: identityOverrideProcessor,
        shouldApply: function (f) { return f.type === FieldType.number; },
    });
}
//# sourceMappingURL=stacking.js.map