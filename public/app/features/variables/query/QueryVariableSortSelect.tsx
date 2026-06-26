import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableSort } from '@grafana/data';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

const SORT_OPTIONS = [
  { label: 'Отключена', value: VariableSort.disabled },
  { label: 'Алфавитный (А-Я)', value: VariableSort.alphabeticalAsc },
  { label: 'Алфавитный (Я-A)', value: VariableSort.alphabeticalDesc },
  { label: 'Численный (по возрастанию)', value: VariableSort.numericalAsc },
  { label: 'Численный (по убыванию)', value: VariableSort.numericalDesc },
  { label: 'Алфавитный (нечувствительный к регистру, А-Я)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
  { label: 'Алфавитный (нечувствительный к регистру, Я-A)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
  { label: 'Натуральная (по возрастанию)', value: VariableSort.naturalAsc },
  { label: 'Натуральная (по убыванию)', value: VariableSort.naturalDesc },
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
