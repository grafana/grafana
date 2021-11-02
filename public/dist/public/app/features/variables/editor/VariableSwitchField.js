import React from 'react';
import { InlineField, InlineSwitch } from '@grafana/ui';
export function VariableSwitchField(_a) {
    var value = _a.value, name = _a.name, tooltip = _a.tooltip, onChange = _a.onChange, ariaLabel = _a.ariaLabel;
    return (React.createElement(InlineField, { label: name, labelWidth: 20, tooltip: tooltip },
        React.createElement(InlineSwitch, { label: name, value: value, onChange: onChange, "aria-label": ariaLabel })));
}
//# sourceMappingURL=VariableSwitchField.js.map