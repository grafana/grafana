import { __assign, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { ValueMatcherID } from '@grafana/data';
import { convertToType } from './utils';
export function rangeMatcherEditor(config) {
    return function (_a) {
        var options = _a.options, onChange = _a.onChange, field = _a.field;
        var validator = config.validator;
        var _b = __read(useState({
            from: !validator(options.from),
            to: !validator(options.to),
        }), 2), isInvalid = _b[0], setInvalid = _b[1];
        var onChangeValue = useCallback(function (event, prop) {
            var _a;
            setInvalid(__assign(__assign({}, isInvalid), (_a = {}, _a[prop] = !validator(event.currentTarget.value), _a)));
        }, [setInvalid, validator, isInvalid]);
        var onChangeOptions = useCallback(function (event, prop) {
            var _a;
            if (isInvalid[prop]) {
                return;
            }
            var value = event.currentTarget.value;
            onChange(__assign(__assign({}, options), (_a = {}, _a[prop] = convertToType(value, field), _a)));
        }, [options, onChange, isInvalid, field]);
        return (React.createElement(React.Fragment, null,
            React.createElement(Input, { className: "flex-grow-1 gf-form-spacing", invalid: isInvalid['from'], defaultValue: String(options.from), placeholder: "From", onChange: function (event) { return onChangeValue(event, 'from'); }, onBlur: function (event) { return onChangeOptions(event, 'from'); } }),
            React.createElement("div", { className: "gf-form-label" }, "and"),
            React.createElement(Input, { className: "flex-grow-1", invalid: isInvalid['to'], defaultValue: String(options.to), placeholder: "To", onChange: function (event) { return onChangeValue(event, 'to'); }, onBlur: function (event) { return onChangeOptions(event, 'to'); } })));
    };
}
export var getRangeValueMatchersUI = function () {
    return [
        {
            name: 'Is between',
            id: ValueMatcherID.between,
            component: rangeMatcherEditor({
                validator: function (value) {
                    return !isNaN(value);
                },
            }),
        },
    ];
};
//# sourceMappingURL=RangeMatcherEditor.js.map