import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableSort } from '@grafana/data';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

const SORT_OPTIONS = [
  { label: 'Disabled', value: VariableSort.Disabled },
  { label: 'Alphabetical (asc)', value: VariableSort.AlphabeticalAsc },
  { label: 'Alphabetical (desc)', value: VariableSort.AlphabeticalDesc },
  { label: 'Numerical (asc)', value: VariableSort.NumericalAsc },
  { label: 'Numerical (desc)', value: VariableSort.NumericalDesc },
  { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.AlphabeticalCaseInsensitiveAsc },
  { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.AlphabeticalCaseInsensitiveDesc },
  { label: 'Natural (asc)', value: VariableSort.NaturalAsc },
  { label: 'Natural (desc)', value: VariableSort.NaturalDesc },
];

export function QueryVariableSortSelect({ onChange, sort, testId }: PropsWithChildren<Props>) {
  const value = useMemo(() => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0], [sort]);

  return (
    <VariableSelectField
      name="Sort"
      description="How to sort the values of this variable"
      value={value}
      options={SORT_OPTIONS}
      onChange={onChange}
      testId={testId}
      width={25}
    />
  );
}
