import React from 'react';
import { createFilter } from 'react-select';
import { Field, Select } from '@grafana/ui';
const _customFilter = createFilter({ ignoreCase: false });
function customFilter(opt, searchQuery) {
    var _a, _b;
    return _customFilter({
        label: (_a = opt.label) !== null && _a !== void 0 ? _a : '',
        value: (_b = opt.value) !== null && _b !== void 0 ? _b : '',
        data: {},
    }, searchQuery);
}
const handleIsValidNewOption = (inputValue, value, options) => {
    const exactValueExists = options.some((el) => el.label === inputValue);
    const valueIsNotEmpty = inputValue.trim().length;
    return !Boolean(exactValueExists) && Boolean(valueIsNotEmpty);
};
const AlertLabelDropdown = React.forwardRef(function labelPicker({ onChange, options, defaultValue, type, onOpenMenu = () => { } }, ref) {
    return (React.createElement("div", { ref: ref },
        React.createElement(Field, { disabled: false, "data-testid": `alertlabel-${type}-picker` },
            React.createElement(Select, { placeholder: `Choose ${type}`, width: 29, className: "ds-picker select-container", backspaceRemovesValue: false, onChange: onChange, onOpenMenu: onOpenMenu, filterOption: customFilter, isValidNewOption: handleIsValidNewOption, options: options, maxMenuHeight: 500, noOptionsMessage: "No labels found", defaultValue: defaultValue, allowCustomValue: true }))));
});
export default AlertLabelDropdown;
//# sourceMappingURL=AlertLabelDropdown.js.map