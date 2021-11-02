import React, { memo, useCallback } from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { Select } from '../Select/Select';
import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';
export var FieldNameMatcherEditor = memo(function (props) {
    var data = props.data, options = props.options, onChangeFromProps = props.onChange;
    var names = useFieldDisplayNames(data);
    var selectOptions = useSelectOptions(names, options);
    var onChange = useCallback(function (selection) {
        if (!frameHasName(selection.value, names)) {
            return;
        }
        return onChangeFromProps(selection.value);
    }, [names, onChangeFromProps]);
    var selectedOption = selectOptions.find(function (v) { return v.value === options; });
    return React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: selectOptions, onChange: onChange });
});
FieldNameMatcherEditor.displayName = 'FieldNameMatcherEditor';
export var fieldNameMatcherItem = {
    id: FieldMatcherID.byName,
    component: FieldNameMatcherEditor,
    matcher: fieldMatchers.get(FieldMatcherID.byName),
    name: 'Fields with name',
    description: 'Set properties for a specific field',
    optionsToLabel: function (options) { return options; },
};
//# sourceMappingURL=FieldNameMatcherEditor.js.map