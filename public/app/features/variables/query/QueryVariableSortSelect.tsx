import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableSort } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

const SORT_OPTIONS = [
  { label: 'Disabled', value: VariableSort.disabled },
  { label: 'Alphabetical (asc)', value: VariableSort.alphabeticalAsc },
  { label: 'Alphabetical (desc)', value: VariableSort.alphabeticalDesc },
  { label: 'Numerical (asc)', value: VariableSort.numericalAsc },
  { label: 'Numerical (desc)', value: VariableSort.numericalDesc },
  { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
  { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
  { label: 'Natural (asc)', value: VariableSort.naturalAsc },
  { label: 'Natural (desc)', value: VariableSort.naturalDesc },
];

export function QueryVariableSortSelect({ onChange, sort, testId }: PropsWithChildren<Props>) {
  const value = useMemo(() => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0], [sort]);

  return (
    <VariableSelectField
      name="Sort"
      description={t(
        'variables.query-variable-sort-select.description-values-variable',
        'How to sort the values of this variable'
      )}
      value={value}
      options={SORT_OPTIONS}
      onChange={onChange}
      testId={testId}
      width={25}
    />
  );
}
