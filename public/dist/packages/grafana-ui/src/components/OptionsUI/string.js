import React, { useCallback } from 'react';
import { Input } from '../Input/Input';
import { TextArea } from '../TextArea/TextArea';
export var StringValueEditor = function (_a) {
    var _b, _c, _d, _e;
    var value = _a.value, onChange = _a.onChange, item = _a.item;
    var Component = ((_b = item.settings) === null || _b === void 0 ? void 0 : _b.useTextarea) ? TextArea : Input;
    var onValueChange = useCallback(function (e) {
        var _a;
        var nextValue = value !== null && value !== void 0 ? value : '';
        if (e.hasOwnProperty('key')) {
            // handling keyboard event
            var evt = e;
            if (evt.key === 'Enter' && !((_a = item.settings) === null || _a === void 0 ? void 0 : _a.useTextarea)) {
                nextValue = evt.currentTarget.value.trim();
            }
        }
        else {
            // handling form event
            var evt = e;
            nextValue = evt.currentTarget.value.trim();
        }
        if (nextValue === value) {
            return; // no change
        }
        onChange(nextValue === '' ? undefined : nextValue);
    }, [value, (_c = item.settings) === null || _c === void 0 ? void 0 : _c.useTextarea, onChange]);
    return (React.createElement(Component, { placeholder: (_d = item.settings) === null || _d === void 0 ? void 0 : _d.placeholder, defaultValue: value || '', rows: (((_e = item.settings) === null || _e === void 0 ? void 0 : _e.useTextarea) && item.settings.rows) || 5, onBlur: onValueChange, onKeyDown: onValueChange }));
};
//# sourceMappingURL=string.js.map