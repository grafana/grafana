import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useEffect } from 'react';
import { Checkbox, Field, Input, InputControl, Select, TextArea } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { SubformField } from './SubformField';
import { css } from '@emotion/css';
import { KeyValueMapInput } from './KeyValueMapInput';
import { SubformArrayField } from './SubformArrayField';
import { StringArrayInput } from './StringArrayInput';
export var OptionField = function (_a) {
    var option = _a.option, invalid = _a.invalid, pathPrefix = _a.pathPrefix, error = _a.error, defaultValue = _a.defaultValue, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    if (option.element === 'subform') {
        return (React.createElement(SubformField, { readOnly: readOnly, defaultValue: defaultValue, option: option, errors: error, pathPrefix: pathPrefix }));
    }
    if (option.element === 'subform_array') {
        return (React.createElement(SubformArrayField, { readOnly: readOnly, defaultValues: defaultValue, option: option, pathPrefix: pathPrefix, errors: error }));
    }
    return (React.createElement(Field, { label: option.element !== 'checkbox' ? option.label : undefined, description: option.description || undefined, invalid: !!error, error: error === null || error === void 0 ? void 0 : error.message },
        React.createElement(OptionInput, { id: "" + pathPrefix + option.propertyName, defaultValue: defaultValue, option: option, invalid: invalid, pathPrefix: pathPrefix, readOnly: readOnly })));
};
var OptionInput = function (_a) {
    var option = _a.option, invalid = _a.invalid, id = _a.id, _b = _a.pathPrefix, pathPrefix = _b === void 0 ? '' : _b, _c = _a.readOnly, readOnly = _c === void 0 ? false : _c;
    var _d = useFormContext(), control = _d.control, register = _d.register, unregister = _d.unregister;
    var name = "" + pathPrefix + option.propertyName;
    // workaround for https://github.com/react-hook-form/react-hook-form/issues/4993#issuecomment-829012506
    useEffect(function () { return function () {
        unregister(name, { keepValue: false });
    }; }, [unregister, name]);
    switch (option.element) {
        case 'checkbox':
            return (React.createElement(Checkbox, __assign({ id: id, readOnly: readOnly, disabled: readOnly, className: styles.checkbox }, register(name), { label: option.label, description: option.description })));
        case 'input':
            return (React.createElement(Input, __assign({ id: id, readOnly: readOnly, invalid: invalid, type: option.inputType }, register(name, {
                required: option.required ? 'Required' : false,
                validate: function (v) { return (option.validationRule !== '' ? validateOption(v, option.validationRule) : true); },
            }), { placeholder: option.placeholder })));
        case 'select':
            return (React.createElement(InputControl, { render: function (_a) {
                    var _b;
                    var _c = _a.field, onChange = _c.onChange, ref = _c.ref, field = __rest(_c, ["onChange", "ref"]);
                    return (React.createElement(Select, __assign({ disabled: readOnly, menuShouldPortal: true }, field, { options: (_b = option.selectOptions) !== null && _b !== void 0 ? _b : undefined, invalid: invalid, onChange: function (value) { return onChange(value.value); } })));
                }, control: control, name: name }));
        case 'textarea':
            return (React.createElement(TextArea, __assign({ id: id, readOnly: readOnly, invalid: invalid }, register(name, {
                required: option.required ? 'Required' : false,
                validate: function (v) { return (option.validationRule !== '' ? validateOption(v, option.validationRule) : true); },
            }))));
        case 'string_array':
            return (React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, value = _b.value, onChange = _b.onChange;
                    return (React.createElement(StringArrayInput, { readOnly: readOnly, value: value, onChange: onChange }));
                }, control: control, name: name }));
        case 'key_value_map':
            return (React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, value = _b.value, onChange = _b.onChange;
                    return (React.createElement(KeyValueMapInput, { readOnly: readOnly, value: value, onChange: onChange }));
                }, control: control, name: name }));
        default:
            console.error('Element not supported', option.element);
            return null;
    }
};
var styles = {
    checkbox: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    height: auto; // native chekbox has fixed height which does not take into account description\n  "], ["\n    height: auto; // native chekbox has fixed height which does not take into account description\n  "]))),
};
var validateOption = function (value, validationRule) {
    return RegExp(validationRule).test(value) ? true : 'Invalid format';
};
var templateObject_1;
//# sourceMappingURL=OptionField.js.map