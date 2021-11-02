import { __read, __spreadArray } from "tslib";
import { Input, Select } from '@grafana/ui';
import React, { useEffect, useMemo, useState } from 'react';
export var SelectWithAdd = function (_a) {
    var value = _a.value, onChange = _a.onChange, options = _a.options, className = _a.className, placeholder = _a.placeholder, width = _a.width, custom = _a.custom, onCustomChange = _a.onCustomChange, _b = _a.disabled, disabled = _b === void 0 ? false : _b, _c = _a.addLabel, addLabel = _c === void 0 ? '+ Add new' : _c;
    var _d = __read(useState(custom), 2), isCustom = _d[0], setIsCustom = _d[1];
    useEffect(function () {
        if (custom) {
            setIsCustom(custom);
        }
    }, [custom]);
    var _options = useMemo(function () { return __spreadArray(__spreadArray([], __read(options), false), [{ value: '__add__', label: addLabel }], false); }, [
        options,
        addLabel,
    ]);
    if (isCustom) {
        return (React.createElement(Input, { width: width, autoFocus: !custom, value: value || '', placeholder: placeholder, className: className, disabled: disabled, onChange: function (e) { return onChange(e.target.value); } }));
    }
    else {
        return (React.createElement(Select, { menuShouldPortal: true, width: width, options: _options, value: value, className: className, placeholder: placeholder, disabled: disabled, onChange: function (val) {
                var value = val === null || val === void 0 ? void 0 : val.value;
                if (value === '__add__') {
                    setIsCustom(true);
                    if (onCustomChange) {
                        onCustomChange(true);
                    }
                    onChange('');
                }
                else {
                    onChange(value);
                }
            } }));
    }
};
//# sourceMappingURL=SelectWIthAdd.js.map