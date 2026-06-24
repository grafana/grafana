import { type PropsWithChildren, useMemo } from 'react';

import { type SelectableValue, VariableSort } from '@grafana/data';
import { t } from '@grafana/i18n';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

<<<<<<< HEAD
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

=======
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
export function QueryVariableSortSelect({ onChange, sort, testId }: PropsWithChildren<Props>) {
  const SORT_OPTIONS = useMemo(
    () => [
      {
        label: t('variables.query-variable-sort-select.sort_options.label.disabled', 'Disabled'),
        value: VariableSort.disabled,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.alphabetical-asc', 'Alphabetical (asc)'),
        value: VariableSort.alphabeticalAsc,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.alphabetical-desc', 'Alphabetical (desc)'),
        value: VariableSort.alphabeticalDesc,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.numerical-asc', 'Numerical (asc)'),
        value: VariableSort.numericalAsc,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.numerical-desc', 'Numerical (desc)'),
        value: VariableSort.numericalDesc,
      },
      {
        label: t(
          'variables.query-variable-sort-select.sort_options.label.alphabetical-caseinsensitive-asc',
          'Alphabetical (case-insensitive, asc)'
        ),
        value: VariableSort.alphabeticalCaseInsensitiveAsc,
      },
      {
        label: t(
          'variables.query-variable-sort-select.sort_options.label.alphabetical-caseinsensitive-desc',
          'Alphabetical (case-insensitive, desc)'
        ),
        value: VariableSort.alphabeticalCaseInsensitiveDesc,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.natural-asc', 'Natural (asc)'),
        value: VariableSort.naturalAsc,
      },
      {
        label: t('variables.query-variable-sort-select.sort_options.label.natural-desc', 'Natural (desc)'),
        value: VariableSort.naturalDesc,
      },
    ],
    []
  );

  const value = useMemo(() => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0], [sort, SORT_OPTIONS]);

  return (
    <VariableSelectField
      name={t('variables.query-variable-sort-select.name-sort', 'Sort')}
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
