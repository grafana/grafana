import { useEffect, useMemo, useState } from 'react';

import {
  type Field,
  formattedValueToString,
  getDisplayProcessor,
  type RangeValueMatcherOptions,
  type SelectableValue,
} from '@grafana/data';
import { type ValueSetOptions } from '@grafana/data/internal';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { useTableFilters } from '../TableFilterContext';
import { tableFilterKey } from '../transformations/filterByValue';
import { createRangePredicate } from '../transformations/rangeFilter';
import { createValuePredicate, unsupportedFilterReason } from '../transformations/valueFilter';
import { FilterOperator, type TableRow } from '../types';
import { getDisplayName } from '../utils';

import { type FilterPopupProps } from './FilterPopup';
import { operatorSelectableValues } from './utils';

interface UseFilterPopupStateOptions {
  name: string;
  field?: Field;
  timeZone?: string;
  parentIndex?: number;
  /** Cross-filter rows keyed by filter key. Each entry holds the rows available *before* that filter was applied. */
  crossFilterRows: Record<string, () => TableRow[]>;
  /** Rows surviving all active filters. Used for brand-new (not-yet-active) filter popups. */
  crossFilterTailRows: TableRow[];
}

interface UseFilterPopupState {
  isPopoverVisible: boolean;
  setPopoverVisible: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether this column currently has an active filter, for styling the control that opens the popup. */
  filterEnabled: boolean;
  unsupportedReason?: 'multiple' | 'uneditable';
  /** Everything `FilterPopup` needs except the element it anchors to, which the caller owns. */
  popupProps: Omit<FilterPopupProps, 'buttonElement'>;
}

/**
 * Owns the state behind a column's filter popup: whether it's open, and the search/operator values
 * that have to outlive a close so reopening the popup restores what the user typed.
 *
 * Shared by the inline header `Filter` button and the `table.refresh` header column menu — the
 * cross-filter row scoping below has to stay identical between the two, so it lives here rather
 * than being reimplemented per trigger.
 */
export function useFilterPopupState({
  name,
  field,
  timeZone,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
}: UseFilterPopupStateOptions): UseFilterPopupState {
  const theme = useTheme2();
  const view = useTableFilters();
  const selected = useMemo(
    () => (field ? (view?.getFilters(field, parentIndex) ?? []) : []),
    [view, field, parentIndex]
  );
  const selectedConfig = selected[0];
  const snapshot = useMemo(
    () => (selected.length === 1 ? JSON.stringify(selectedConfig) : String(selected.length)),
    [selectedConfig, selected.length]
  );
  const predicate = selected[0]?.options.filters[0]?.config;
  const unsupportedReason = unsupportedFilterReason(selected);
  const selection: ValueSetOptions | undefined = predicate?.id === 'inSet' ? predicate.options : undefined;
  const range: RangeValueMatcherOptions<number> | undefined =
    predicate?.id === 'between' ? predicate.options : undefined;
  const filterKey = useMemo(() => (field ? tableFilterKey(field, parentIndex) : name), [field, parentIndex, name]);

  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [operator, setOperator] = useState<SelectableValue<FilterOperator>>(
    operatorSelectableValues()[FilterOperator.CONTAINS]
  );

  useEffect(() => {
    setSearchFilter('');
    setOperator(operatorSelectableValues()[FilterOperator.CONTAINS]);
    if (unsupportedReason) {
      setPopoverVisible(false);
    }
  }, [snapshot, unsupportedReason]);

  // Show options scoped to the current cross-filter state:
  // - Active filter: rows available before that filter was applied (keeps its own options visible).
  // - New filter: rows surviving all active filters (the tail).
  // - No active filters at all: fall back to raw rows.
  const rowsForPopup = useMemo(
    () => (isPopoverVisible ? (crossFilterRows[filterKey]?.() ?? crossFilterTailRows) : []),
    [isPopoverVisible, crossFilterRows, crossFilterTailRows, filterKey]
  );
  const filterValue = useMemo(() => {
    if (!isPopoverVisible || !selection) {
      return undefined;
    }
    if (
      !field ||
      !selection.displayConfig ||
      (selection.displayConfig === field.config && selection.timeZone === timeZone)
    ) {
      return selection.values.map((value) => ({ value, label: String(value) }));
    }
    const selected = new Set(selection.values.map(String));
    const previousDisplay = getDisplayProcessor({
      field: { ...field, config: selection.displayConfig },
      theme,
      timeZone: selection.timeZone,
    });
    const currentDisplay = field.display ?? getDisplayProcessor({ field, theme, timeZone });
    const currentValues = new Set<string>();
    const fieldName = getDisplayName(field);
    for (const row of rowsForPopup) {
      if (row.__depth !== 0) {
        continue;
      }
      const raw = row[fieldName];
      if (selection.includeMissing !== undefined && raw == null) {
        continue;
      }
      if (selected.has(formattedValueToString(previousDisplay(raw)))) {
        currentValues.add(formattedValueToString(currentDisplay(raw)));
      }
    }
    return Array.from(currentValues, (value) => ({ value, label: value }));
  }, [isPopoverVisible, selection, field, timeZone, theme, rowsForPopup]);

  return {
    isPopoverVisible,
    setPopoverVisible,
    filterEnabled: selected.length > 0,
    unsupportedReason,
    popupProps: {
      stateKey: snapshot,
      rangeFiltersEnabled: view?.rangeFiltersEnabled,
      onApplyValues: (values, includeMissing) => {
        if (view && field) {
          if (values.length === 0 && !includeMissing) {
            view.clearFilter(field, parentIndex);
          } else {
            view.applyFilter(
              field,
              createValuePredicate(
                field,
                values.map((item) => item.value),
                selection,
                timeZone,
                includeMissing
              ),
              parentIndex
            );
          }
        }
      },
      onApplyRange:
        view && field
          ? ({ min, max, includeMissing }) =>
              view.applyFilter(field, createRangePredicate({ min, max, includeMissing }), parentIndex)
          : undefined,
      onClear: () => field && view?.clearFilter(field, parentIndex),
      timeZone,
      includeMissing: selection?.includeMissing,
      range: range ? { min: range.from, max: range.to, includeMissing: range.includeMissing === true } : undefined,
      rows: rowsForPopup,
      filterValue: filterValue ?? (range && !view?.rangeFiltersEnabled ? [] : undefined),
      field,
      onClose: () => setPopoverVisible(false),
      searchFilter,
      setSearchFilter,
      operator,
      setOperator,
    },
  };
}
