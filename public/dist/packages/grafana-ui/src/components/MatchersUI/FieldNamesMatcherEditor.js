import { __assign } from "tslib";
import React, { memo, useCallback } from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { MultiSelect } from '../Select/Select';
import { Input } from '../Input/Input';
import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';
export var FieldNamesMatcherEditor = memo(function (props) {
    var _a;
    var data = props.data, options = props.options, onChangeFromProps = props.onChange;
    var readOnly = options.readOnly, prefix = options.prefix;
    var names = useFieldDisplayNames(data);
    var selectOptions = useSelectOptions(names, undefined);
    var onChange = useCallback(function (selections) {
        if (!Array.isArray(selections)) {
            return;
        }
        return onChangeFromProps(__assign(__assign({}, options), { names: selections.reduce(function (all, current) {
                if (!frameHasName(current.value, names)) {
                    return all;
                }
                all.push(current.value);
                return all;
            }, []) }));
    }, [names, onChangeFromProps, options]);
    if (readOnly) {
        var displayNames = ((_a = options.names) !== null && _a !== void 0 ? _a : []).join(', ');
        return React.createElement(Input, { value: displayNames, readOnly: true, disabled: true, prefix: prefix });
    }
    return React.createElement(MultiSelect, { menuShouldPortal: true, value: options.names, options: selectOptions, onChange: onChange });
});
FieldNamesMatcherEditor.displayName = 'FieldNameMatcherEditor';
export var fieldNamesMatcherItem = {
    id: FieldMatcherID.byNames,
    component: FieldNamesMatcherEditor,
    matcher: fieldMatchers.get(FieldMatcherID.byNames),
    name: 'Fields with name',
    description: 'Set properties for a specific field',
    optionsToLabel: function (options) { var _a; return ((_a = options.names) !== null && _a !== void 0 ? _a : []).join(', '); },
    excludeFromPicker: true,
};
//# sourceMappingURL=FieldNamesMatcherEditor.js.map