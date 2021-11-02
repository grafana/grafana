import { __read, __spreadArray } from "tslib";
import React, { useMemo, useCallback } from 'react';
import { flatten } from 'lodash';
import { LegacyForms } from '@grafana/ui';
var Select = LegacyForms.Select;
export var MetricSelect = function (props) {
    var value = props.value, placeholder = props.placeholder, className = props.className, isSearchable = props.isSearchable, onChange = props.onChange;
    var options = useSelectOptions(props);
    var selected = useSelectedOption(options, value);
    var onChangeValue = useCallback(function (selectable) { return onChange(selectable.value); }, [onChange]);
    return (React.createElement(Select, { menuShouldPortal: true, className: className, isMulti: false, isClearable: false, backspaceRemovesValue: false, onChange: onChangeValue, options: options, isSearchable: isSearchable, maxMenuHeight: 500, placeholder: placeholder, noOptionsMessage: function () { return 'No options found'; }, value: selected }));
};
var useSelectOptions = function (_a) {
    var _b = _a.variables, variables = _b === void 0 ? [] : _b, options = _a.options;
    return useMemo(function () {
        if (!Array.isArray(variables) || variables.length === 0) {
            return options;
        }
        return __spreadArray([
            {
                label: 'Template Variables',
                options: variables.map(function (_a) {
                    var name = _a.name;
                    return ({
                        label: "$" + name,
                        value: "$" + name,
                    });
                }),
            }
        ], __read(options), false);
    }, [variables, options]);
};
var useSelectedOption = function (options, value) {
    return useMemo(function () {
        var allOptions = options.every(function (o) { return o.options; }) ? flatten(options.map(function (o) { return o.options; })) : options;
        return allOptions.find(function (option) { return option.value === value; });
    }, [options, value]);
};
//# sourceMappingURL=MetricSelect.js.map