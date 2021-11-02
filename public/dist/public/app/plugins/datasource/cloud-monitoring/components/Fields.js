import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { HorizontalGroup, InlineLabel, Select, InlineField } from '@grafana/ui';
import { css } from '@emotion/css';
import { INNER_LABEL_WIDTH, LABEL_WIDTH } from '../constants';
export var VariableQueryField = function (_a) {
    var label = _a.label, onChange = _a.onChange, value = _a.value, options = _a.options, _b = _a.allowCustomValue, allowCustomValue = _b === void 0 ? false : _b;
    return (React.createElement(InlineField, { label: label, labelWidth: 20 },
        React.createElement(Select, { menuShouldPortal: true, width: 25, allowCustomValue: allowCustomValue, value: value, onChange: function (_a) {
                var value = _a.value;
                return onChange(value);
            }, options: options })));
};
export var QueryEditorRow = function (_a) {
    var children = _a.children, label = _a.label, tooltip = _a.tooltip, fillComponent = _a.fillComponent, _b = _a.noFillEnd, noFillEnd = _b === void 0 ? false : _b, _c = _a.labelWidth, labelWidth = _c === void 0 ? LABEL_WIDTH : _c, rest = __rest(_a, ["children", "label", "tooltip", "fillComponent", "noFillEnd", "labelWidth"]);
    return (React.createElement("div", __assign({ className: "gf-form" }, rest),
        label && (React.createElement(InlineLabel, { width: labelWidth, tooltip: tooltip }, label)),
        React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          margin-right: 4px;\n        "], ["\n          margin-right: 4px;\n        "]))) },
            React.createElement(HorizontalGroup, { spacing: "xs", width: "auto" }, children)),
        React.createElement("div", { className: 'gf-form--grow' }, noFillEnd || React.createElement("div", { className: 'gf-form-label gf-form-label--grow' }, fillComponent))));
};
export var QueryEditorField = function (_a) {
    var children = _a.children, label = _a.label, tooltip = _a.tooltip, _b = _a.labelWidth, labelWidth = _b === void 0 ? INNER_LABEL_WIDTH : _b, rest = __rest(_a, ["children", "label", "tooltip", "labelWidth"]);
    return (React.createElement(React.Fragment, null,
        label && (React.createElement(InlineLabel, __assign({ width: labelWidth, tooltip: tooltip }, rest), label)),
        children));
};
var templateObject_1;
//# sourceMappingURL=Fields.js.map