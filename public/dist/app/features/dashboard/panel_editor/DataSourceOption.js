import React from 'react';
import { FormLabel } from '@grafana/ui';
export var DataSourceOption = function (_a) {
    var label = _a.label, placeholder = _a.placeholder, name = _a.name, value = _a.value, onBlur = _a.onBlur, onChange = _a.onChange, tooltipInfo = _a.tooltipInfo;
    return (React.createElement("div", { className: "gf-form gf-form--flex-end" },
        React.createElement(FormLabel, { tooltip: tooltipInfo }, label),
        React.createElement("input", { type: "text", className: "gf-form-input width-6", placeholder: placeholder, name: name, spellCheck: false, onBlur: onBlur, onChange: onChange, value: value })));
};
//# sourceMappingURL=DataSourceOption.js.map