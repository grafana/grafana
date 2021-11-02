import { __assign, __makeTemplateObject, __rest } from "tslib";
import { omit } from 'lodash';
import React from 'react';
import { FormField } from '../FormField/FormField';
import { Button } from '../Button/Button';
import { css, cx } from '@emotion/css';
var getSecretFormFieldStyles = function () {
    return {
        noRadiusInput: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-bottom-right-radius: 0 !important;\n      border-top-right-radius: 0 !important;\n    "], ["\n      border-bottom-right-radius: 0 !important;\n      border-top-right-radius: 0 !important;\n    "]))),
        noRadiusButton: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      border-bottom-left-radius: 0 !important;\n      border-top-left-radius: 0 !important;\n    "], ["\n      border-bottom-left-radius: 0 !important;\n      border-top-left-radius: 0 !important;\n    "]))),
    };
};
/**
 * Form field that has 2 states configured and not configured. If configured it will not show its contents and adds
 * a reset button that will clear the input and makes it accessible. In non configured state it behaves like normal
 * form field. This is used for passwords or anything that is encrypted on the server and is later returned encrypted
 * to the user (like datasource passwords).
 */
export var SecretFormField = function (_a) {
    var _b = _a.label, label = _b === void 0 ? 'Password' : _b, labelWidth = _a.labelWidth, _c = _a.inputWidth, inputWidth = _c === void 0 ? 12 : _c, onReset = _a.onReset, isConfigured = _a.isConfigured, tooltip = _a.tooltip, _d = _a.placeholder, placeholder = _d === void 0 ? 'Password' : _d, inputProps = __rest(_a, ["label", "labelWidth", "inputWidth", "onReset", "isConfigured", "tooltip", "placeholder"]);
    var styles = getSecretFormFieldStyles();
    return (React.createElement(FormField, { label: label, tooltip: tooltip, labelWidth: labelWidth, inputEl: isConfigured ? (React.createElement(React.Fragment, null,
            React.createElement("input", __assign({ type: "text", className: cx("gf-form-input width-" + inputWidth, styles.noRadiusInput), disabled: true, value: "configured" }, omit(inputProps, 'value'))),
            React.createElement(Button, { onClick: onReset, variant: "secondary" }, "Reset"))) : (React.createElement("input", __assign({ type: "password", className: "gf-form-input width-" + inputWidth, placeholder: placeholder }, inputProps))) }));
};
SecretFormField.displayName = 'SecretFormField';
var templateObject_1, templateObject_2;
//# sourceMappingURL=SecretFormField.js.map