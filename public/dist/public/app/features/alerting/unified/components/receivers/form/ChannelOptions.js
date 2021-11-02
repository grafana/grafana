import React from 'react';
import { Button, Field, Input } from '@grafana/ui';
import { OptionField } from './fields/OptionField';
import { useFormContext } from 'react-hook-form';
export function ChannelOptions(_a) {
    var defaultValues = _a.defaultValues, selectedChannelOptions = _a.selectedChannelOptions, onResetSecureField = _a.onResetSecureField, secureFields = _a.secureFields, errors = _a.errors, _b = _a.pathPrefix, pathPrefix = _b === void 0 ? '' : _b, _c = _a.readOnly, readOnly = _c === void 0 ? false : _c;
    var watch = useFormContext().watch;
    var currentFormValues = watch(); // react hook form types ARE LYING!
    return (React.createElement(React.Fragment, null, selectedChannelOptions.map(function (option, index) {
        var _a, _b;
        var key = option.label + "-" + index;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        var selectedOptionValue = currentFormValues[pathPrefix + "settings." + option.showWhen.field];
        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
            return null;
        }
        if (secureFields && secureFields[option.propertyName]) {
            return (React.createElement(Field, { key: key, label: option.label, description: option.description || undefined },
                React.createElement(Input, { readOnly: true, value: "Configured", suffix: readOnly ? null : (React.createElement(Button, { onClick: function () { return onResetSecureField(option.propertyName); }, variant: "link", type: "button", size: "sm" }, "Clear")) })));
        }
        var error = (_a = (option.secure
            ? errors === null || errors === void 0 ? void 0 : errors.secureSettings
            : errors === null || errors === void 0 ? void 0 : errors.settings)) === null || _a === void 0 ? void 0 : _a[option.propertyName];
        var defaultValue = (_b = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.settings) === null || _b === void 0 ? void 0 : _b[option.propertyName];
        return (React.createElement(OptionField, { defaultValue: defaultValue, readOnly: readOnly, key: key, error: error, pathPrefix: option.secure ? pathPrefix + "secureSettings." : pathPrefix + "settings.", option: option }));
    })));
}
//# sourceMappingURL=ChannelOptions.js.map