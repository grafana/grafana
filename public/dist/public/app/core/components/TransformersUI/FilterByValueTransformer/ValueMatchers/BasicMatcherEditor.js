import { __assign, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { ValueMatcherID } from '@grafana/data';
import { convertToType } from './utils';
export function basicMatcherEditor(config) {
    return function Render(_a) {
        var options = _a.options, onChange = _a.onChange, field = _a.field;
        var validator = config.validator, _b = config.converter, converter = _b === void 0 ? convertToType : _b;
        var value = options.value;
        var _c = __read(useState(!validator(value)), 2), isInvalid = _c[0], setInvalid = _c[1];
        var onChangeValue = useCallback(function (event) {
            setInvalid(!validator(event.currentTarget.value));
        }, [setInvalid, validator]);
        var onChangeOptions = useCallback(function (event) {
            if (isInvalid) {
                return;
            }
            var value = event.currentTarget.value;
            onChange(__assign(__assign({}, options), { value: converter(value, field) }));
        }, [options, onChange, isInvalid, field, converter]);
        return (React.createElement(Input, { className: "flex-grow-1", invalid: isInvalid, defaultValue: String(options.value), placeholder: "Value", onChange: onChangeValue, onBlur: onChangeOptions }));
    };
}
export var getBasicValueMatchersUI = function () {
    return [
        {
            name: 'Is greater',
            id: ValueMatcherID.greater,
            component: basicMatcherEditor({
                validator: function (value) { return !isNaN(value); },
            }),
        },
        {
            name: 'Is greater or equal',
            id: ValueMatcherID.greaterOrEqual,
            component: basicMatcherEditor({
                validator: function (value) { return !isNaN(value); },
            }),
        },
        {
            name: 'Is lower',
            id: ValueMatcherID.lower,
            component: basicMatcherEditor({
                validator: function (value) { return !isNaN(value); },
            }),
        },
        {
            name: 'Is lower or equal',
            id: ValueMatcherID.lowerOrEqual,
            component: basicMatcherEditor({
                validator: function (value) { return !isNaN(value); },
            }),
        },
        {
            name: 'Is equal',
            id: ValueMatcherID.equal,
            component: basicMatcherEditor({
                validator: function () { return true; },
            }),
        },
        {
            name: 'Is not equal',
            id: ValueMatcherID.notEqual,
            component: basicMatcherEditor({
                validator: function () { return true; },
            }),
        },
        {
            name: 'Regex',
            id: ValueMatcherID.regex,
            component: basicMatcherEditor({
                validator: function () { return true; },
                converter: function (value) { return String(value); },
            }),
        },
    ];
};
//# sourceMappingURL=BasicMatcherEditor.js.map