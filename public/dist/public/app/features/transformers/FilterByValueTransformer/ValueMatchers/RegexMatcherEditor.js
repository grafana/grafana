import React, { useCallback, useState } from 'react';
import { ValueMatcherID } from '@grafana/data';
import { Input } from '@grafana/ui';
import { convertToType } from './utils';
export function regexMatcherEditor(config) {
    return function Render({ options, onChange, field }) {
        const { validator, converter = convertToType } = config;
        const { value } = options;
        const [isInvalid, setInvalid] = useState(!validator(value));
        const onChangeValue = useCallback((event) => {
            setInvalid(!validator(event.currentTarget.value));
        }, [setInvalid, validator]);
        const onChangeOptions = useCallback((event) => {
            if (isInvalid) {
                return;
            }
            const { value } = event.currentTarget;
            onChange(Object.assign(Object.assign({}, options), { value: converter(value, field) }));
        }, [options, onChange, isInvalid, field, converter]);
        return (React.createElement(Input, { className: "flex-grow-1", invalid: isInvalid, defaultValue: String(options.value), placeholder: "Value", onChange: onChangeValue, onBlur: onChangeOptions }));
    };
}
export const getRegexValueMatchersUI = () => {
    return [
        {
            name: 'Regex',
            id: ValueMatcherID.regex,
            component: regexMatcherEditor({
                validator: () => true,
                converter: (value) => String(value),
            }),
        },
    ];
};
//# sourceMappingURL=RegexMatcherEditor.js.map