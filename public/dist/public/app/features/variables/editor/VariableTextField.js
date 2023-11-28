import { useId } from '@react-aria/utils';
import React from 'react';
import { Field, Input } from '@grafana/ui';
export function VariableTextField({ value, name, placeholder = '', onChange, testId, width, required, onBlur, grow, description, invalid, error, maxLength, }) {
    const id = useId(name);
    return (React.createElement(Field, { label: name, description: description, invalid: invalid, error: error, htmlFor: id },
        React.createElement(Input, { type: "text", id: id, placeholder: placeholder, value: value, onChange: onChange, onBlur: onBlur, width: grow ? undefined : width !== null && width !== void 0 ? width : 30, "data-testid": testId, maxLength: maxLength, required: required })));
}
//# sourceMappingURL=VariableTextField.js.map