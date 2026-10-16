import { useEffect, useState } from 'react';

import { type Field, type RangeValueMatcherOptions, type SelectableValue } from '@grafana/data';
import { type ValueSetOptions } from '@grafana/data/internal';

import { useTableFilters } from '../TableFilterContext';
import { tableFilterKey } from '../transformations/filterByValue';
import { createValuePredicate, editableValueFilter } from '../transformations/valueFilter';
import { FilterOperator, type TableRow } from '../types';

import { type FilterPopupProps } from './FilterPopup';
import { operatorSelectableValues } from './utils';

interface UseFilterPopupStateOptions {
  name: string;
  field?: Field;
  timeZone?: string;
  parentIndex?: number;
  /** Cross-filter rows keyed by filter key. Each entry holds the rows available *before* that filter was applied. */
  crossFilterRows: Record<string, TableRow[]>;
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
  const view = useTableFilters();
  const selected = field ? (view?.getFilters(field, parentIndex) ?? []) : [];
  const snapshot = JSON.stringify(selected);
  const predicate = selected[0]?.options.filters[0]?.config;
  const unsupportedReason =
    selected.length > 1
      ? 'multiple'
      : selected.some((config) => !editableValueFilter(config))
        ? 'uneditable'
        : undefined;
  const selection: ValueSetOptions | undefined = predicate?.id === 'inSet' ? predicate.options : undefined;
  const range: RangeValueMatcherOptions<number> | undefined =
    predicate?.id === 'between' ? predicate.options : undefined;
  const filterKey = field ? tableFilterKey(field, parentIndex) : name;
  const filterValue = selection?.values.map((value) => ({ value, label: String(value) }));

  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
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
  const rowsForPopup = filterKey in crossFilterRows ? crossFilterRows[filterKey] : crossFilterTailRows;

  return {
    isPopoverVisible,
    setPopoverVisible,
    filterEnabled: selected.length > 0,
    unsupportedReason,
    popupProps: {
      stateKey: snapshot,
      onApplyValues: (values) => {
        if (view && field) {
          if (values.length === 0) {
            view.clearFilter(field, parentIndex);
          } else {
            view.applyFilter(
              field,
              createValuePredicate(
                field,
                values.map((item) => item.value),
                selection,
                timeZone
              ),
              parentIndex
            );
          }
        }
      },
      onApplyRange:
        view && field
          ? ({ min, max, includeMissing }) =>
              view.applyFilter(
                field,
                {
                  id: 'between',
                  options: {
                    from: min,
                    to: max,
                    inclusive: true,
                    allowOpenBounds: true,
                    includeMissing,
                  } satisfies RangeValueMatcherOptions<number>,
                },
                parentIndex
              )
          : undefined,
      onClear: () => field && view?.clearFilter(field, parentIndex),
      range: range ? { min: range.from, max: range.to, includeMissing: range.includeMissing === true } : undefined,
      rows: rowsForPopup,
      filterValue,
      field,
      onClose: () => setPopoverVisible(false),
      searchFilter,
      setSearchFilter,
      operator,
      setOperator,
    },
  };
}
