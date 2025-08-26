import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableSort } from '@grafana/data';
import { t } from '@grafana/i18n';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

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
