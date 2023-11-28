import React from 'react';
import { Field, Select } from '@grafana/ui';
export const VariableQueryField = ({ label, onChange, value, options, allowCustomValue = false, }) => {
    return (React.createElement(Field, { label: label },
        React.createElement(Select, { width: 25, allowCustomValue: allowCustomValue, value: value, onChange: ({ value }) => onChange(value), options: options })));
};
//# sourceMappingURL=Fields.js.map