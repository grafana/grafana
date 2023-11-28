import React, { useMemo } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableSort } from '../types';
const SORT_OPTIONS = [
    { label: 'Disabled', value: VariableSort.disabled },
    { label: 'Alphabetical (asc)', value: VariableSort.alphabeticalAsc },
    { label: 'Alphabetical (desc)', value: VariableSort.alphabeticalDesc },
    { label: 'Numerical (asc)', value: VariableSort.numericalAsc },
    { label: 'Numerical (desc)', value: VariableSort.numericalDesc },
    { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
    { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
];
export function QueryVariableSortSelect({ onChange, sort }) {
    const value = useMemo(() => { var _a; return (_a = SORT_OPTIONS.find((o) => o.value === sort)) !== null && _a !== void 0 ? _a : SORT_OPTIONS[0]; }, [sort]);
    return (React.createElement(VariableSelectField, { name: "Sort", description: "How to sort the values of this variable", value: value, options: SORT_OPTIONS, onChange: onChange, testId: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2, width: 25 }));
}
//# sourceMappingURL=QueryVariableSortSelect.js.map