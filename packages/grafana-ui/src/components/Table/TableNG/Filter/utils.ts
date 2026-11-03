import { useMemo } from 'react';

import { formattedValueToString, guessDecimals, type Field, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { FilterOperator, type TableRow } from '../types';
import { getDisplayName } from '../utils';

export function calculateUniqueFieldValues(rows: TableRow[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};

  for (const row of rows) {
    if (row.__depth > 0) {
      continue;
    }
    const value = getFieldFilterValue(row, field);
    set[value || t('grafana-ui.table.filter.blanks', '(Blanks)')] = value;
  }

  return set;
}

export function getFieldFilterValue(row: TableRow, field: Field): string {
  const fieldValue = row[getDisplayName(field)];
  return field.display ? formattedValueToString(field.display(fieldValue)) : String(fieldValue);
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

export function rangeHistogram(values: unknown[]) {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const bins = Array.from({ length: finite.length === 0 ? 0 : min === max ? 1 : 30 }, () => 0);
  for (const value of finite) {
    const index = min === max ? 0 : Math.min(bins.length - 1, Math.floor(((value - min) / (max - min)) * bins.length));
    bins[index]++;
  }
  return { finite, min, max, bins, missing: values.length - finite.length };
}

export function useRangeValues(field: Field, rows: TableRow[]) {
  const values = useMemo(
    () => rows.filter((row) => row.__depth === 0).map((row) => field.values[row.__index]),
    [rows, field]
  );
  const histogram = useMemo(() => rangeHistogram(values), [values]);
  return { values, histogram };
}

export function rangeValidation(min?: number, max?: number) {
  const minimumInvalid = min != null && !Number.isFinite(min);
  const maximumInvalid = max != null && !Number.isFinite(max);
  const boundsReversed = min != null && max != null && min > max;
  return {
    minimumInvalid,
    maximumInvalid,
    boundsReversed,
    invalid: minimumInvalid || maximumInvalid || boundsReversed,
  };
}

export function sliderDecimals(values: number[], range: number) {
  const dataDecimals = values.reduce(
    (decimals, value) => Math.max(decimals, guessDecimals(Number(value.toPrecision(12)))),
    0
  );
  const rangeDecimals = range > 0 ? Math.max(0, Math.ceil(-Math.log10(range / 1000))) : 0;
  return Math.min(100, Math.max(dataDecimals, rangeDecimals));
}

export function sliderBoundText(
  value: number,
  currentValue: number,
  currentText: string,
  decimals: number,
  extent?: number
) {
  if (value === currentValue) {
    return currentText;
  }
  return String(value === extent ? value : Number(value.toFixed(decimals)));
}
