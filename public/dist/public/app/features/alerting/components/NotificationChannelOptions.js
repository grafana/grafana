import { __assign } from "tslib";
import React from 'react';
import { Button, Checkbox, Field, Input } from '@grafana/ui';
import { OptionElement } from './OptionElement';
export var NotificationChannelOptions = function (_a) {
    var control = _a.control, currentFormValues = _a.currentFormValues, errors = _a.errors, selectedChannelOptions = _a.selectedChannelOptions, register = _a.register, onResetSecureField = _a.onResetSecureField, secureFields = _a.secureFields;
    return (React.createElement(React.Fragment, null, selectedChannelOptions.map(function (option, index) {
        var _a;
        var key = option.label + "-" + index;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        var selectedOptionValue = currentFormValues["settings." + option.showWhen.field] &&
            currentFormValues["settings." + option.showWhen.field].value;
        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
            return null;
        }
        if (option.element === 'checkbox') {
            return (React.createElement(Field, { key: key },
                React.createElement(Checkbox, __assign({}, register(option.secure ? "secureSettings." + option.propertyName : "settings." + option.propertyName), { label: option.label, description: option.description }))));
        }
        return (React.createElement(Field, { key: key, label: option.label, description: option.description, invalid: errors.settings && !!errors.settings[option.propertyName], error: errors.settings && ((_a = errors.settings[option.propertyName]) === null || _a === void 0 ? void 0 : _a.message) }, secureFields && secureFields[option.propertyName] ? (React.createElement(Input, { readOnly: true, value: "Configured", suffix: React.createElement(Button, { onClick: function () { return onResetSecureField(option.propertyName); }, fill: "text", type: "button", size: "sm" }, "Clear") })) : (React.createElement(OptionElement, { option: option, register: register, control: control }))));
    })));
};
//# sourceMappingURL=NotificationChannelOptions.js.map