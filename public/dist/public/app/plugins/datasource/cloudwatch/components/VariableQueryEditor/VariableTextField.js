import React, { useState } from 'react';
import { InlineField, Input } from '@grafana/ui';
const LABEL_WIDTH = 20;
export const VariableTextField = ({ interactive, label, onBlur, placeholder, value, tooltip }) => {
    const [localValue, setLocalValue] = useState(value);
    return (React.createElement(InlineField, { interactive: interactive, label: label, labelWidth: LABEL_WIDTH, tooltip: tooltip, grow: true },
        React.createElement(Input, { "aria-label": label, placeholder: placeholder, value: localValue, onChange: (e) => setLocalValue(e.currentTarget.value), onBlur: () => onBlur(localValue), width: 25 })));
};
//# sourceMappingURL=VariableTextField.js.map