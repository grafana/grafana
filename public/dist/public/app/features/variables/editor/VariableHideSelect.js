import React, { useMemo } from 'react';
import { VariableHide } from '@grafana/data';
import { Field, RadioButtonGroup } from '@grafana/ui';
const HIDE_OPTIONS = [
    { label: 'Label and value', value: VariableHide.dontHide },
    { label: 'Value', value: VariableHide.hideLabel },
    { label: 'Nothing', value: VariableHide.hideVariable },
];
export function VariableHideSelect({ onChange, hide, type }) {
    const value = useMemo(() => { var _a, _b; return (_b = (_a = HIDE_OPTIONS.find((o) => o.value === hide)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : HIDE_OPTIONS[0].value; }, [hide]);
    if (type === 'constant') {
        return null;
    }
    return (React.createElement(Field, { label: "Show on dashboard" },
        React.createElement(RadioButtonGroup, { options: HIDE_OPTIONS, onChange: onChange, value: value })));
}
//# sourceMappingURL=VariableHideSelect.js.map