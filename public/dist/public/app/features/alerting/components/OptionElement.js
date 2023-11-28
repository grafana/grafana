import { __rest } from "tslib";
import React from 'react';
import { Input, InputControl, Select, TextArea } from '@grafana/ui';
export const OptionElement = ({ control, option, register, invalid }) => {
    const modelValue = option.secure ? `secureSettings.${option.propertyName}` : `settings.${option.propertyName}`;
    switch (option.element) {
        case 'input':
            return (React.createElement(Input, Object.assign({}, register(`${modelValue}`, {
                required: option.required ? 'Required' : false,
                validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
            }), { invalid: invalid, type: option.inputType, placeholder: option.placeholder })));
        case 'select':
            return (React.createElement(InputControl, { control: control, name: `${modelValue}`, render: (_a) => {
                    var _b;
                    var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                    return (React.createElement(Select, Object.assign({}, field, { options: (_b = option.selectOptions) !== null && _b !== void 0 ? _b : undefined, invalid: invalid })));
                } }));
        case 'textarea':
            return (React.createElement(TextArea, Object.assign({ invalid: invalid }, register(`${modelValue}`, {
                required: option.required ? 'Required' : false,
                validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
            }))));
        default:
            console.error('Element not supported', option.element);
            return null;
    }
};
const validateOption = (value, validationRule) => {
    return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
//# sourceMappingURL=OptionElement.js.map