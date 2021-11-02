import React, { memo, useCallback } from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { Input } from '../Input/Input';
export var FieldNameByRegexMatcherEditor = memo(function (props) {
    var options = props.options, onChange = props.onChange;
    var onBlur = useCallback(function (e) {
        return onChange(e.target.value);
    }, [onChange]);
    return React.createElement(Input, { placeholder: "Enter regular expression", defaultValue: options, onBlur: onBlur });
});
FieldNameByRegexMatcherEditor.displayName = 'FieldNameByRegexMatcherEditor';
export var fieldNameByRegexMatcherItem = {
    id: FieldMatcherID.byRegexp,
    component: FieldNameByRegexMatcherEditor,
    matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
    name: 'Fields with name matching regex',
    description: 'Set properties for fields with names matching a regex',
    optionsToLabel: function (options) { return options; },
};
//# sourceMappingURL=FieldNameByRegexMatcherEditor.js.map