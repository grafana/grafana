import React, { useCallback } from 'react';
import { Input, TextArea } from '@grafana/ui';
export const StringValueEditor = ({ value, onChange, item, suffix }) => {
    var _a, _b, _c, _d;
    const Component = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.useTextarea) ? TextArea : Input;
    const onValueChange = useCallback((e) => {
        var _a;
        let nextValue = value !== null && value !== void 0 ? value : '';
        if ('key' in e) {
            // handling keyboard event
            if (e.key === 'Enter' && !((_a = item.settings) === null || _a === void 0 ? void 0 : _a.useTextarea)) {
                nextValue = e.currentTarget.value.trim();
            }
        }
        else {
            // handling blur event
            nextValue = e.currentTarget.value.trim();
        }
        if (nextValue === value) {
            return; // no change
        }
        onChange(nextValue === '' ? undefined : nextValue);
    }, [value, (_b = item.settings) === null || _b === void 0 ? void 0 : _b.useTextarea, onChange]);
    return (React.createElement(Component, { placeholder: (_c = item.settings) === null || _c === void 0 ? void 0 : _c.placeholder, defaultValue: value || '', rows: (((_d = item.settings) === null || _d === void 0 ? void 0 : _d.useTextarea) && item.settings.rows) || 5, onBlur: onValueChange, onKeyDown: onValueChange, suffix: suffix }));
};
//# sourceMappingURL=string.js.map