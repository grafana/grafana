import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { InlineFormLabel } from '../FormLabel/FormLabel';
var defaultProps = {
    labelWidth: 6,
    inputWidth: 12,
};
/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 */
export var FormField = function (_a) {
    var label = _a.label, tooltip = _a.tooltip, labelWidth = _a.labelWidth, inputWidth = _a.inputWidth, inputEl = _a.inputEl, className = _a.className, inputProps = __rest(_a, ["label", "tooltip", "labelWidth", "inputWidth", "inputEl", "className"]);
    var styles = getStyles();
    return (React.createElement("div", { className: cx(styles.formField, className) },
        React.createElement(InlineFormLabel, { width: labelWidth, tooltip: tooltip }, label),
        inputEl || (React.createElement("input", __assign({ type: "text", className: "gf-form-input " + (inputWidth ? "width-" + inputWidth : '') }, inputProps)))));
};
FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;
var getStyles = function () {
    return {
        formField: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=FormField.js.map