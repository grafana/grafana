import { __read, __spreadArray } from "tslib";
import { useState } from 'react';
var hasValue = function (searchValue) { return function (_a) {
    var value = _a.value;
    return value === searchValue;
}; };
var getInitialState = function (initialOptions, initialValue) {
    if (initialValue === undefined || initialOptions.some(hasValue(initialValue))) {
        return initialOptions;
    }
    return __spreadArray(__spreadArray([], __read(initialOptions), false), [
        {
            value: initialValue,
            label: initialValue,
        },
    ], false);
};
/**
 * Creates the Props needed by Select to handle custom values and handles custom value creation
 * and the initial value when it is not present in the option array.
 */
export var useCreatableSelectPersistedBehaviour = function (_a) {
    var initialOptions = _a.options, value = _a.value, onChange = _a.onChange;
    var _b = __read(useState(getInitialState(initialOptions, value)), 2), options = _b[0], setOptions = _b[1];
    var addOption = function (newValue) { return setOptions(__spreadArray(__spreadArray([], __read(options), false), [{ value: newValue, label: newValue }], false)); };
    return {
        onCreateOption: function (value) {
            addOption(value);
            onChange({ value: value });
        },
        onChange: onChange,
        allowCustomValue: true,
        options: options,
        value: value,
    };
};
//# sourceMappingURL=useCreatableSelectPersistedBehaviour.js.map