import { Field, formattedValueToString, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { FilterOperator, TableRow } from '../types';
import { getDisplayName } from '../utils';

export function calculateUniqueFieldValues(rows: TableRow[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const fieldValue = row[getDisplayName(field)];
    const value = field.display ? formattedValueToString(field.display(fieldValue)) : String(fieldValue);

    set[value || '(Blanks)'] = value;
  }

  return set;
}

export function getFilteredOptions(options: SelectableValue[], filterValues?: SelectableValue[]): SelectableValue[] {
  if (!filterValues) {
    return [];
  }

  return options.filter((option) => filterValues.some((filtered) => filtered.value === option.value));
}

export function valuesToOptions(unique: Record<string, unknown>): SelectableValue[] {
  return Object.keys(unique)
    .map((key) => ({ value: unique[key], label: key }))
    .sort(sortOptions);
}

function sortOptions(a: SelectableValue, b: SelectableValue): number {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
}

export const operatorSelectableValues = () => {
  const toSelectableValue = (operator: FilterOperator, label: string, description = label) => ({
    label: operator,
    ariaLabel: label,
    value: operator,
    description,
  });

  return {
    [FilterOperator.CONTAINS]: toSelectableValue(
      FilterOperator.CONTAINS,
      t('grafana-ui.table.filter.operator.contains', 'Contains')
    ),
    [FilterOperator.EQUALS]: toSelectableValue(
      FilterOperator.EQUALS,
      t('grafana-ui.table.filter.operator.equals', 'Equals')
    ),
    [FilterOperator.NOT_EQUALS]: toSelectableValue(
      FilterOperator.NOT_EQUALS,
      t('grafana-ui.table.filter.operator.not-equals', 'Not equals')
    ),
    [FilterOperator.GREATER]: toSelectableValue(
      FilterOperator.GREATER,
      t('grafana-ui.table.filter.operator.greater', 'Greater')
    ),
    [FilterOperator.GREATER_OR_EQUAL]: toSelectableValue(
      FilterOperator.GREATER_OR_EQUAL,
      t('grafana-ui.table.filter.operator.greater-or-equal', 'Greater or Equal')
    ),
    [FilterOperator.LESS]: toSelectableValue(FilterOperator.LESS, t('grafana-ui.table.filter.operator.less', 'Less')),
    [FilterOperator.LESS_OR_EQUAL]: toSelectableValue(
      FilterOperator.LESS_OR_EQUAL,
      t('grafana-ui.table.filter.operator.less-or-equal', 'Less or Equal')
    ),
    [FilterOperator.EXPRESSION]: toSelectableValue(
      FilterOperator.EXPRESSION,
      t('grafana-ui.table.filter.operator.expression', 'Expression'),
      t(
        'grafana-ui.table.filter.operator.expression-description',
        'Bool Expression (Char $ represents the column value in the expression, e.g. "$ >= 10 && $ <= 12")'
      )
    ),
  };
};
