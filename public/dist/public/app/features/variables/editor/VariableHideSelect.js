import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableHide } from '../types';
var HIDE_OPTIONS = [
    { label: '', value: VariableHide.dontHide },
    { label: 'Label', value: VariableHide.hideLabel },
    { label: 'Variable', value: VariableHide.hideVariable },
];
export function VariableHideSelect(_a) {
    var onChange = _a.onChange, hide = _a.hide, type = _a.type;
    var value = useMemo(function () { var _a; return (_a = HIDE_OPTIONS.find(function (o) { return o.value === hide; })) !== null && _a !== void 0 ? _a : HIDE_OPTIONS[0]; }, [hide]);
    if (type === 'constant') {
        return null;
    }
    return (React.createElement(VariableSelectField, { name: "Hide", value: value, options: HIDE_OPTIONS, onChange: onChange, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect }));
}
//# sourceMappingURL=VariableHideSelect.js.map