import React from 'react';
import { InlineField, Select } from '@grafana/ui';
const LABEL_WIDTH = 20;
export const VariableQueryField = ({ label, onChange, value, options, allowCustomValue = false, isLoading = false, inputId = label, }) => {
    return (React.createElement(InlineField, { label: label, labelWidth: LABEL_WIDTH, htmlFor: inputId },
        React.createElement(Select, { "aria-label": label, width: 25, allowCustomValue: allowCustomValue, value: value, onChange: ({ value }) => onChange(value), options: options, isLoading: isLoading, inputId: inputId })));
};
//# sourceMappingURL=VariableQueryField.js.map