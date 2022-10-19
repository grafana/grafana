import React, { PropsWithChildren, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableSort } from '../types';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
}

const SORT_OPTIONS = [
  { label: 'Disabled', value: VariableSort.disabled },
  { label: 'Alphabetical (asc)', value: VariableSort.alphabeticalAsc },
  { label: 'Alphabetical (desc)', value: VariableSort.alphabeticalDesc },
  { label: 'Numerical (asc)', value: VariableSort.numericalAsc },
  { label: 'Numerical (desc)', value: VariableSort.numericalDesc },
  { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
  { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
];

export function QueryVariableSortSelect({ onChange, sort }: PropsWithChildren<Props>) {
  const value = useMemo(() => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0], [sort]);

  return (
    <VariableSelectField
      name="Sort"
      description="How to sort the values of this variable"
      value={value}
      options={SORT_OPTIONS}
      onChange={onChange}
      testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2}
      width={25}
    />
  );
}
