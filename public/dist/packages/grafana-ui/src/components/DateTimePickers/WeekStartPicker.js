import React, { useCallback } from 'react';
import { Select } from '../Select/Select';
import { selectors } from '@grafana/e2e-selectors';
var weekStarts = [
    { value: '', label: 'Default' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
];
export var WeekStartPicker = function (props) {
    var _a;
    var onChange = props.onChange, width = props.width, _b = props.autoFocus, autoFocus = _b === void 0 ? false : _b, onBlur = props.onBlur, value = props.value, _c = props.disabled, disabled = _c === void 0 ? false : _c, inputId = props.inputId;
    var onChangeWeekStart = useCallback(function (selectable) {
        if (selectable.value !== undefined) {
            onChange(selectable.value);
        }
    }, [onChange]);
    return (React.createElement(Select, { inputId: inputId, value: (_a = weekStarts.find(function (item) { return item.value === value; })) === null || _a === void 0 ? void 0 : _a.value, placeholder: "Choose starting day of the week", autoFocus: autoFocus, openMenuOnFocus: true, width: width, options: weekStarts, onChange: onChangeWeekStart, onBlur: onBlur, disabled: disabled, "aria-label": selectors.components.WeekStartPicker.container, menuShouldPortal: true }));
};
//# sourceMappingURL=WeekStartPicker.js.map