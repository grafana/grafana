import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableSort } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<VariableSort>) => void;
  sort: VariableSort;
  testId?: string;
}

const getSortOptions = () => {
  return [
    {
      label: t('bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.disabled', 'Disabled'),
      value: VariableSort.disabled,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.alpha-asc',
        'Alphabetical (asc)'
      ),
      value: VariableSort.alphabeticalAsc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.alpha-dsc',
        'Alphabetical (desc)'
      ),
      value: VariableSort.alphabeticalDesc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.number-asc',
        'Numerical (asc)'
      ),
      value: VariableSort.numericalAsc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.number-dsc',
        'Numerical (desc)'
      ),
      value: VariableSort.numericalDesc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.alpha-case-insensitive-asc',
        'Alphabetical (case-insensitive, asc)'
      ),
      value: VariableSort.alphabeticalCaseInsensitiveAsc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.alpha-case-insensitive-dsc',
        'Alphabetical (case-insensitive, desc)'
      ),
      value: VariableSort.alphabeticalCaseInsensitiveDesc,
    },
    {
      label: t('bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.natural-asc', 'Natural (asc)'),
      value: VariableSort.naturalAsc,
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-options.natural-dsc',
        'Natural (desc)'
      ),
      value: VariableSort.naturalDesc,
    },
  ];
};

export function QueryVariableSortSelect({ onChange, sort, testId }: PropsWithChildren<Props>) {
  const SORT_OPTIONS = useMemo(() => getSortOptions(), []);
  const value = useMemo(() => SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0], [SORT_OPTIONS, sort]);
  return (
    <VariableSelectField
      name={t('bmcgrafana.dashboards.settings.variables.editor.types.query.sort', 'Sort')}
      description={t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.sort-desc',
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
