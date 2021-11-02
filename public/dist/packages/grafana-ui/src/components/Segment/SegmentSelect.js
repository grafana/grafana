import { __assign, __rest } from "tslib";
import React, { useRef } from 'react';
import { AsyncSelect, Select } from '../Select/Select';
import { useTheme2 } from '../../themes/ThemeContext';
/** @internal */
export function SegmentSelect(_a) {
    var value = _a.value, _b = _a.placeholder, placeholder = _b === void 0 ? '' : _b, _c = _a.options, options = _c === void 0 ? [] : _c, onChange = _a.onChange, onClickOutside = _a.onClickOutside, _d = _a.loadOptions, loadOptions = _d === void 0 ? undefined : _d, widthPixels = _a.width, _e = _a.noOptionsMessage, noOptionsMessage = _e === void 0 ? '' : _e, _f = _a.allowCustomValue, allowCustomValue = _f === void 0 ? false : _f, _g = _a.allowEmptyValue, allowEmptyValue = _g === void 0 ? false : _g, rest = __rest(_a, ["value", "placeholder", "options", "onChange", "onClickOutside", "loadOptions", "width", "noOptionsMessage", "allowCustomValue", "allowEmptyValue"]);
    var ref = useRef(null);
    var theme = useTheme2();
    var width = widthPixels > 0 ? widthPixels / theme.spacing.gridSize : undefined;
    var Component;
    var asyncOptions = {};
    if (loadOptions) {
        Component = AsyncSelect;
        asyncOptions = { loadOptions: loadOptions, defaultOptions: true };
    }
    else {
        Component = Select;
    }
    return (React.createElement("div", __assign({}, rest, { ref: ref }),
        React.createElement(Component, __assign({ menuShouldPortal: true, width: width, noOptionsMessage: noOptionsMessage, placeholder: placeholder, autoFocus: true, isOpen: true, onChange: onChange, options: options, value: value, 
            // Disable "close menu on select" option to avoid calling onChange() in onCloseMenu() when a value is selected.
            // Once the value is selected the Select component (with the menu) will be hidden anyway by the parent component:
            // Segment or SegmentAsync - hence setting this option has no UX effect.
            closeMenuOnSelect: false, onCloseMenu: function () {
                if (ref && ref.current) {
                    // https://github.com/JedWatson/react-select/issues/188#issuecomment-279240292
                    // Unfortunately there's no other way of retrieving the value (not yet) created new option
                    var input = ref.current.querySelector('input[id^="react-select-"]');
                    if (input && (input.value || allowEmptyValue)) {
                        onChange({ value: input.value, label: input.value });
                    }
                    else {
                        onClickOutside();
                    }
                }
            }, allowCustomValue: allowCustomValue }, asyncOptions))));
}
//# sourceMappingURL=SegmentSelect.js.map