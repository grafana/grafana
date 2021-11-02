import { __read } from "tslib";
import React, { useState } from 'react';
import { Button } from '../Button';
import { Select } from '../Select/Select';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2 } from '../../themes';
export function ValuePicker(_a) {
    var label = _a.label, icon = _a.icon, options = _a.options, onChange = _a.onChange, variant = _a.variant, _b = _a.minWidth, minWidth = _b === void 0 ? 16 : _b, _c = _a.size, size = _c === void 0 ? 'sm' : _c, _d = _a.isFullWidth, isFullWidth = _d === void 0 ? true : _d, menuPlacement = _a.menuPlacement;
    var _e = __read(useState(false), 2), isPicking = _e[0], setIsPicking = _e[1];
    var theme = useTheme2();
    return (React.createElement(React.Fragment, null,
        !isPicking && (React.createElement(Button, { size: size || 'sm', icon: icon || 'plus', onClick: function () { return setIsPicking(true); }, variant: variant, fullWidth: isFullWidth, "aria-label": selectors.components.ValuePicker.button(label) }, label)),
        isPicking && (React.createElement("span", { style: { minWidth: theme.spacing(minWidth), flexGrow: isFullWidth ? 1 : undefined } },
            React.createElement(Select, { menuShouldPortal: true, placeholder: label, options: options, "aria-label": selectors.components.ValuePicker.select(label), isOpen: true, onCloseMenu: function () { return setIsPicking(false); }, autoFocus: true, onChange: function (value) {
                    setIsPicking(false);
                    onChange(value);
                }, menuPlacement: menuPlacement })))));
}
//# sourceMappingURL=ValuePicker.js.map