import { useMemo } from 'react';

import {
  type DisplayProcessor,
  formattedValueToString,
  guessDecimals,
  type Field,
  type SelectableValue,
} from '@grafana/data';
import { getValueSetCandidates, type ValueSetOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { fieldFiltersByElements } from '../transformations/valueFilter';
import { FilterOperator, type TableRow } from '../types';
import { getDisplayName } from '../utils';

export function calculateUniqueFieldValues(rows: TableRow[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};
  const blanks = t('grafana-ui.table.filter.blanks', '(Blanks)');

  for (const row of rows) {
    if (row.__depth > 0) {
      continue;
    }
    for (const value of getFieldFilterValues(row, field)) {
      set[value || blanks] = value;
    }
  }

  return set;
}

export function getFieldFilterValue(row: TableRow, field: Field): string {
  const fieldValue = row[getDisplayName(field)];
  return field.display ? formattedValueToString(field.display(fieldValue)) : String(fieldValue);
}

/**
 * Display strings a row contributes to value filtering. Multi-valued cells
 * (arrays, or pill-formatted strings) expand to one string per element so each
 * entry becomes its own filter option; anything else yields the single
 * whole-value string from getFieldFilterValue.
 */
export function getFieldFilterValues(row: TableRow, field: Field): string[] {
  const fieldValue = row[getDisplayName(field)];
  return getValueSetCandidates(field, fieldValue).map((candidate) =>
    field.display ? formattedValueToString(field.display(candidate)) : String(candidate)
  );
}

/** True when any of the row's filter values is in the selected set. */
export function rowMatchesFilterValues(row: TableRow, field: Field, selectedValues: Set<unknown>): boolean {
  return getFieldFilterValues(row, field).some((value) => selectedValues.has(value));
}

/**
 * True when an inSet selection was saved as whole-cell values before
 * element-wise filtering existed: selections on element-wise fields that carry
 * no matchElements flag. Reopening such a popup must map the stored values
 * onto the per-element options instead of showing an empty selection.
 */
export function isLegacyWholeCellSelection(field: Field, selection: ValueSetOptions): boolean {
  return selection.matchElements !== true && fieldFiltersByElements(field);
}

/**
 * Map a whole-cell inSet selection saved before element-wise filtering onto
 * the current per-element options. Each row whose whole-cell filter value was
 * stored contributes its current per-element values; stored values matching no
 * row drop out like any other stale selection. Scalar fields are unaffected:
 * their whole-cell and per-element values are identical.
 */
export function restoreWholeCellSelections(
  rows: TableRow[],
  field: Field,
  storedValues: unknown[]
): string[] {
  const stored = new Set(storedValues.map(String));
  const restored = new Set<string>();
  for (const row of rows) {
    if (row.__depth !== 0) {
      continue;
    }
    if (stored.has(getFieldFilterValue(row, field))) {
      for (const value of getFieldFilterValues(row, field)) {
        restored.add(value);
      }
    }
  }
  return Array.from(restored);
}

export interface RemapSelectionsOptions {
  rows: TableRow[];
  field: Field;
  storedValues: unknown[];
  previousDisplay: DisplayProcessor;
  currentDisplay: DisplayProcessor;
  includeMissing?: boolean;
  /** True when the stored values are whole-cell strings saved before element-wise filtering. */
  legacyWholeCell: boolean;
}

/**
 * Remap stored display strings onto current display strings after a display
 * config change. Legacy whole-cell values match the whole raw value under the
 * previous display and expand to current per-element strings; per-element
 * values remap candidate by candidate.
 */
export function remapSelectionsToCurrentDisplay({
  rows,
  field,
  storedValues,
  previousDisplay,
  currentDisplay,
  includeMissing,
  legacyWholeCell,
}: RemapSelectionsOptions): string[] {
  const selected = new Set(storedValues.map(String));
  const currentValues = new Set<string>();
  const fieldName = getDisplayName(field);
  for (const row of rows) {
    if (row.__depth !== 0) {
      continue;
    }
    const raw = row[fieldName];
    if (includeMissing !== undefined && raw == null) {
      continue;
    }
    if (legacyWholeCell) {
      if (selected.has(formattedValueToString(previousDisplay(raw)))) {
        for (const candidate of getValueSetCandidates(field, raw)) {
          currentValues.add(formattedValueToString(currentDisplay(candidate)));
        }
      }
      continue;
    }
    for (const candidate of getValueSetCandidates(field, raw)) {
      if (selected.has(formattedValueToString(previousDisplay(candidate)))) {
        currentValues.add(formattedValueToString(currentDisplay(candidate)));
      }
    }
  }
  return Array.from(currentValues);
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
