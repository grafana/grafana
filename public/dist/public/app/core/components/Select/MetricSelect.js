import { flatten } from 'lodash';
import React, { useMemo, useCallback } from 'react';
import { LegacyForms } from '@grafana/ui';
const { Select } = LegacyForms;
export const MetricSelect = (props) => {
    const { value, placeholder, className, isSearchable, onChange } = props;
    const options = useSelectOptions(props);
    const selected = useSelectedOption(options, value);
    const onChangeValue = useCallback((selectable) => onChange(selectable.value), [onChange]);
    return (React.createElement(Select, { className: className, isMulti: false, isClearable: false, backspaceRemovesValue: false, onChange: onChangeValue, options: options, isSearchable: isSearchable, maxMenuHeight: 500, placeholder: placeholder, noOptionsMessage: () => 'No options found', value: selected }));
};
const useSelectOptions = ({ variables = [], options }) => {
    return useMemo(() => {
        if (!Array.isArray(variables) || variables.length === 0) {
            return options;
        }
        return [
            {
                label: 'Template Variables',
                options: variables.map(({ name }) => ({
                    label: `$${name}`,
                    value: `$${name}`,
                })),
            },
            ...options,
        ];
    }, [variables, options]);
};
const useSelectedOption = (options, value) => {
    return useMemo(() => {
        const allOptions = options.every((o) => o.options) ? flatten(options.map((o) => o.options)) : options;
        return allOptions.find((option) => option.value === value);
    }, [options, value]);
};
//# sourceMappingURL=MetricSelect.js.map