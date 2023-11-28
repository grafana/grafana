import React, { useCallback } from 'react';
import { DashboardPicker as BasePicker } from 'app/core/components/Select/DashboardPicker';
/** This will return the item UID */
export const DashboardPicker = ({ value, onChange, item }) => {
    var _a;
    const { placeholder, isClearable } = (_a = item === null || item === void 0 ? void 0 : item.settings) !== null && _a !== void 0 ? _a : {};
    const onPicked = useCallback((sel) => {
        var _a;
        onChange((_a = sel === null || sel === void 0 ? void 0 : sel.value) === null || _a === void 0 ? void 0 : _a.uid);
    }, [onChange]);
    return (React.createElement(BasePicker, { isClearable: isClearable, defaultOptions: true, onChange: onPicked, placeholder: placeholder, value: value }));
};
//# sourceMappingURL=DashboardPicker.js.map