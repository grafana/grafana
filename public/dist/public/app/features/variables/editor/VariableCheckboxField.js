import { useId } from '@react-aria/utils';
import React from 'react';
import { Checkbox } from '@grafana/ui';
export function VariableCheckboxField({ value, name, description, onChange, ariaLabel, }) {
    const uniqueId = useId();
    return (React.createElement(Checkbox, { id: uniqueId, label: name, description: description, value: value, onChange: onChange, "aria-label": ariaLabel }));
}
//# sourceMappingURL=VariableCheckboxField.js.map