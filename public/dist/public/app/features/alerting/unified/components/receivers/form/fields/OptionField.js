import { __rest } from "tslib";
import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox, Field, Input, InputControl, RadioButtonList, Select, TextArea, useStyles2 } from '@grafana/ui';
import { KeyValueMapInput } from './KeyValueMapInput';
import { StringArrayInput } from './StringArrayInput';
import { SubformArrayField } from './SubformArrayField';
import { SubformField } from './SubformField';
export const OptionField = ({ option, invalid, pathPrefix, pathSuffix = '', error, defaultValue, readOnly = false, customValidator, }) => {
    const optionPath = `${pathPrefix}${pathSuffix}`;
    if (option.element === 'subform') {
        return (React.createElement(SubformField, { readOnly: readOnly, defaultValue: defaultValue, option: option, errors: error, pathPrefix: optionPath }));
    }
    if (option.element === 'subform_array') {
        return (React.createElement(SubformArrayField, { readOnly: readOnly, defaultValues: defaultValue, option: option, pathPrefix: optionPath, errors: error }));
    }
    return (React.createElement(Field, { label: option.element !== 'checkbox' && option.element !== 'radio' ? option.label : undefined, description: option.description || undefined, invalid: !!error, error: error === null || error === void 0 ? void 0 : error.message, "data-testid": `${optionPath}${option.propertyName}` },
        React.createElement(OptionInput, { id: `${optionPath}${option.propertyName}`, defaultValue: defaultValue, option: option, invalid: invalid, pathPrefix: optionPath, readOnly: readOnly, pathIndex: pathPrefix, customValidator: customValidator })));
};
const OptionInput = ({ option, invalid, id, pathPrefix = '', pathIndex = '', readOnly = false, customValidator, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const { control, register, unregister, getValues } = useFormContext();
    const name = `${pathPrefix}${option.propertyName}`;
    // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
    useEffect(() => () => {
        unregister(name, { keepValue: false });
    }, [unregister, name]);
    switch (option.element) {
        case 'checkbox':
            return (React.createElement(Checkbox, Object.assign({ id: id, readOnly: readOnly, disabled: readOnly, className: styles.checkbox }, register(name), { label: option.label, description: option.description })));
        case 'input':
            return (React.createElement(Input, Object.assign({ id: id, readOnly: readOnly || determineReadOnly(option, getValues, pathIndex), invalid: invalid, type: option.inputType }, register(name, {
                required: determineRequired(option, getValues, pathIndex),
                validate: {
                    validationRule: (v) => (option.validationRule ? validateOption(v, option.validationRule) : true),
                    customValidator: (v) => (customValidator ? customValidator(v) : true),
                },
                setValueAs: option.setValueAs,
            }), { placeholder: option.placeholder })));
        case 'select':
            return (React.createElement(InputControl, { render: (_a) => {
                    var _b;
                    var _c = _a.field, { onChange, ref } = _c, field = __rest(_c, ["onChange", "ref"]);
                    return (React.createElement(Select, Object.assign({ disabled: readOnly, options: (_b = option.selectOptions) !== null && _b !== void 0 ? _b : undefined, invalid: invalid, onChange: (value) => onChange(value.value) }, field)));
                }, control: control, name: name, defaultValue: option.defaultValue, rules: {
                    validate: {
                        customValidator: (v) => (customValidator ? customValidator(v) : true),
                    },
                } }));
        case 'radio':
            return (React.createElement(React.Fragment, null,
                React.createElement("legend", { className: styles.legend }, option.label),
                React.createElement(InputControl, { render: (_a) => {
                        var _b;
                        var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                        return (React.createElement(RadioButtonList, Object.assign({ disabled: readOnly, options: (_b = option.selectOptions) !== null && _b !== void 0 ? _b : [] }, field)));
                    }, control: control, defaultValue: (_a = option.defaultValue) === null || _a === void 0 ? void 0 : _a.value, name: name, rules: {
                        required: option.required ? 'Option is required' : false,
                        validate: {
                            validationRule: (v) => (option.validationRule ? validateOption(v, option.validationRule) : true),
                            customValidator: (v) => (customValidator ? customValidator(v) : true),
                        },
                    } })));
        case 'textarea':
            return (React.createElement(TextArea, Object.assign({ id: id, readOnly: readOnly, invalid: invalid, placeholder: option.placeholder }, register(name, {
                required: option.required ? 'Required' : false,
                validate: (v) => (option.validationRule !== '' ? validateOption(v, option.validationRule) : true),
            }))));
        case 'string_array':
            return (React.createElement(InputControl, { render: ({ field: { value, onChange } }) => (React.createElement(StringArrayInput, { readOnly: readOnly, value: value, onChange: onChange })), control: control, name: name }));
        case 'key_value_map':
            return (React.createElement(InputControl, { render: ({ field: { value, onChange } }) => (React.createElement(KeyValueMapInput, { readOnly: readOnly, value: value, onChange: onChange })), control: control, name: name }));
        default:
            console.error('Element not supported', option.element);
            return null;
    }
};
const getStyles = (theme) => ({
    checkbox: css `
    height: auto; // native checkbox has fixed height which does not take into account description
  `,
    legend: css `
    font-size: ${theme.typography.h6.fontSize};
  `,
});
const validateOption = (value, validationRule) => {
    return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
const determineRequired = (option, getValues, pathIndex) => {
    if (!option.dependsOn) {
        return option.required ? 'Required' : false;
    }
    if (isEmpty(getValues(`${pathIndex}secureFields`))) {
        const dependentOn = getValues(`${pathIndex}secureSettings.${option.dependsOn}`);
        return !Boolean(dependentOn) && option.required ? 'Required' : false;
    }
    else {
        const dependentOn = getValues(`${pathIndex}secureFields.${option.dependsOn}`);
        return !dependentOn && option.required ? 'Required' : false;
    }
};
const determineReadOnly = (option, getValues, pathIndex) => {
    if (!option.dependsOn) {
        return false;
    }
    if (isEmpty(getValues(`${pathIndex}secureFields`))) {
        return getValues(`${pathIndex}secureSettings.${option.dependsOn}`);
    }
    else {
        return getValues(`${pathIndex}secureFields.${option.dependsOn}`);
    }
};
//# sourceMappingURL=OptionField.js.map