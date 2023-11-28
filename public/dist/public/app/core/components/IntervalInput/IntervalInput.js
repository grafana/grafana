import React, { useState } from 'react';
import { useDebounce } from 'react-use';
import { InlineField, Input } from '@grafana/ui';
import { validateInterval, validateIntervalRegex } from './validation';
export const IntervalInput = (props) => {
    var _a;
    const validationRegex = props.validationRegex || validateIntervalRegex;
    const [intervalIsInvalid, setIntervalIsInvalid] = useState(() => {
        return props.value ? validateInterval(props.value, validationRegex) : false;
    });
    useDebounce(() => {
        setIntervalIsInvalid(validateInterval(props.value, validationRegex));
    }, 500, [props.value]);
    const fieldProps = {
        labelWidth: 26,
        disabled: (_a = props.disabled) !== null && _a !== void 0 ? _a : false,
        invalid: intervalIsInvalid,
        error: props.isInvalidError,
    };
    if (props.label) {
        fieldProps.label = props.label;
        fieldProps.tooltip = props.tooltip || '';
    }
    return (React.createElement(InlineField, Object.assign({}, fieldProps),
        React.createElement(Input, { type: "text", placeholder: props.placeholder || '0', width: props.width || 40, onChange: (e) => {
                props.onChange(e.currentTarget.value);
            }, value: props.value, "aria-label": props.ariaLabel || 'interval input' })));
};
//# sourceMappingURL=IntervalInput.js.map