import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableSort } from '../types';
var SORT_OPTIONS = [
    { label: 'Disabled', value: VariableSort.disabled },
    { label: 'Alphabetical (asc)', value: VariableSort.alphabeticalAsc },
    { label: 'Alphabetical (desc)', value: VariableSort.alphabeticalDesc },
    { label: 'Numerical (asc)', value: VariableSort.numericalAsc },
    { label: 'Numerical (desc)', value: VariableSort.numericalDesc },
    { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
    { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
];
export function QueryVariableSortSelect(_a) {
    var onChange = _a.onChange, sort = _a.sort;
    var value = useMemo(function () { var _a; return (_a = SORT_OPTIONS.find(function (o) { return o.value === sort; })) !== null && _a !== void 0 ? _a : SORT_OPTIONS[0]; }, [sort]);
    return (React.createElement(VariableSelectField, { name: "Sort", value: value, options: SORT_OPTIONS, onChange: onChange, labelWidth: 10, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelect, tooltip: "How to sort the values of this variable." }));
}
//# sourceMappingURL=QueryVariableSortSelect.js.map