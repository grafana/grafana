import React, { useCallback } from 'react';
import { toIntegerOrUndefined, toFloatOrUndefined, } from '@grafana/data';
import { Input } from '../Input/Input';
export var NumberValueEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange, item = _a.item;
    var settings = item.settings;
    var onValueChange = useCallback(function (e) {
        if (e.hasOwnProperty('key')) {
            // handling keyboard event
            var evt = e;
            if (evt.key === 'Enter') {
                onChange((settings === null || settings === void 0 ? void 0 : settings.integer)
                    ? toIntegerOrUndefined(evt.currentTarget.value)
                    : toFloatOrUndefined(evt.currentTarget.value));
            }
        }
        else {
            // handling form event
            var evt = e;
            onChange((settings === null || settings === void 0 ? void 0 : settings.integer)
                ? toIntegerOrUndefined(evt.currentTarget.value)
                : toFloatOrUndefined(evt.currentTarget.value));
        }
    }, [onChange, settings === null || settings === void 0 ? void 0 : settings.integer]);
    var defaultValue = value === undefined || value === null || isNaN(value) ? '' : value.toString();
    return (React.createElement(Input, { defaultValue: defaultValue, min: settings === null || settings === void 0 ? void 0 : settings.min, max: settings === null || settings === void 0 ? void 0 : settings.max, type: "number", step: settings === null || settings === void 0 ? void 0 : settings.step, placeholder: settings === null || settings === void 0 ? void 0 : settings.placeholder, onBlur: onValueChange, onKeyDown: onValueChange }));
};
//# sourceMappingURL=number.js.map