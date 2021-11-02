import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableRefresh } from '../types';
var REFRESH_OPTIONS = [
    { label: 'On dashboard load', value: VariableRefresh.onDashboardLoad },
    { label: 'On time range change', value: VariableRefresh.onTimeRangeChanged },
];
export function QueryVariableRefreshSelect(_a) {
    var onChange = _a.onChange, refresh = _a.refresh;
    var value = useMemo(function () { var _a; return (_a = REFRESH_OPTIONS.find(function (o) { return o.value === refresh; })) !== null && _a !== void 0 ? _a : REFRESH_OPTIONS[0]; }, [refresh]);
    return (React.createElement(VariableSelectField, { name: "Refresh", value: value, options: REFRESH_OPTIONS, onChange: onChange, labelWidth: 10, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelect, tooltip: "When to update the values of this variable." }));
}
//# sourceMappingURL=QueryVariableRefreshSelect.js.map