import React from 'react';
import { InlineField, Input } from '@grafana/ui';
export function VariableTextField(_a) {
    var value = _a.value, name = _a.name, placeholder = _a.placeholder, onChange = _a.onChange, ariaLabel = _a.ariaLabel, width = _a.width, labelWidth = _a.labelWidth, required = _a.required, onBlur = _a.onBlur, tooltip = _a.tooltip, grow = _a.grow;
    return (React.createElement(InlineField, { label: name, labelWidth: labelWidth !== null && labelWidth !== void 0 ? labelWidth : 12, tooltip: tooltip, grow: grow },
        React.createElement(Input, { type: "text", id: name, name: name, placeholder: placeholder, value: value, onChange: onChange, onBlur: onBlur, width: grow ? undefined : width !== null && width !== void 0 ? width : 25, "aria-label": ariaLabel, required: required })));
}
//# sourceMappingURL=VariableTextField.js.map