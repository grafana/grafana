import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, Field, Input } from '@grafana/ui';
import { OptionField } from './fields/OptionField';
export function ChannelOptions({ defaultValues, selectedChannelOptions, onResetSecureField, secureFields, errors, pathPrefix = '', readOnly = false, customValidators = {}, }) {
    const { watch } = useFormContext();
    const currentFormValues = watch(); // react hook form types ARE LYING!
    return (React.createElement(React.Fragment, null, selectedChannelOptions.map((option, index) => {
        var _a, _b;
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        // pathPrefix = items.index.
        const paths = pathPrefix.split('.');
        const selectedOptionValue = paths.length >= 2 ? currentFormValues.items[Number(paths[1])].settings[option.showWhen.field] : undefined;
        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
            return null;
        }
        if (secureFields && secureFields[option.propertyName]) {
            return (React.createElement(Field, { key: key, label: option.label, description: option.description || undefined },
                React.createElement(Input, { readOnly: true, value: "Configured", suffix: readOnly ? null : (React.createElement(Button, { onClick: () => onResetSecureField(option.propertyName), fill: "text", type: "button", size: "sm" }, "Clear")) })));
        }
        const error = (_a = ((option.secure ? errors === null || errors === void 0 ? void 0 : errors.secureSettings : errors === null || errors === void 0 ? void 0 : errors.settings))) === null || _a === void 0 ? void 0 : _a[option.propertyName];
        const defaultValue = (_b = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.settings) === null || _b === void 0 ? void 0 : _b[option.propertyName];
        return (React.createElement(OptionField, { defaultValue: defaultValue, readOnly: readOnly, key: key, error: error, pathPrefix: pathPrefix, pathSuffix: option.secure ? 'secureSettings.' : 'settings.', option: option, customValidator: customValidators[option.propertyName] }));
    })));
}
//# sourceMappingURL=ChannelOptions.js.map