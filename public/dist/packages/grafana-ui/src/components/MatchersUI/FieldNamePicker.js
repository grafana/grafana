import React, { useCallback } from 'react';
import { Select } from '../Select/Select';
import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';
// Pick a field name out of the fulds
export var FieldNamePicker = function (_a) {
    var _b, _c;
    var value = _a.value, onChange = _a.onChange, context = _a.context, item = _a.item;
    var settings = (_b = item.settings) !== null && _b !== void 0 ? _b : {};
    var names = useFieldDisplayNames(context.data, settings === null || settings === void 0 ? void 0 : settings.filter);
    var selectOptions = useSelectOptions(names, value);
    var onSelectChange = useCallback(function (selection) {
        if (!frameHasName(selection.value, names)) {
            return;
        }
        return onChange(selection.value);
    }, [names, onChange]);
    var selectedOption = selectOptions.find(function (v) { return v.value === value; });
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { menuShouldPortal: true, value: selectedOption, placeholder: (_c = settings.placeholderText) !== null && _c !== void 0 ? _c : 'Select field', options: selectOptions, onChange: onSelectChange, noOptionsMessage: settings.noFieldsMessage, width: settings.width }),
        settings.info && React.createElement(settings.info, { name: value, field: names.fields.get(value) })));
};
//# sourceMappingURL=FieldNamePicker.js.map