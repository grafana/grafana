import { useState } from 'react';

import { type Field, type SelectableValue } from '@grafana/data';

import { FilterOperator, type FilterType, type TableRow } from '../types';

import { type FilterPopupProps } from './FilterPopup';
import { operatorSelectableValues } from './utils';

interface UseFilterPopupStateOptions {
  name: string;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  field?: Field;
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
  filter,
  setFilter,
  field,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
}: UseFilterPopupStateOptions): UseFilterPopupState {
  const filterKey = typeof parentIndex === 'number' ? `${name}-${parentIndex}` : name;
  const filterValue = filter[filterKey]?.filtered;

  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState(filter[filterKey]?.searchFilter || '');
  const [operator, setOperator] = useState<SelectableValue<FilterOperator>>(
    filter[filterKey]?.operator ?? operatorSelectableValues()[FilterOperator.CONTAINS]
  );

  // Show options scoped to the current cross-filter state:
  // - Active filter: rows available before that filter was applied (keeps its own options visible).
  // - New filter: rows surviving all active filters (the tail).
  // - No active filters at all: fall back to raw rows.
  const rowsForPopup = filterKey in crossFilterRows ? crossFilterRows[filterKey] : crossFilterTailRows;

  return {
    isPopoverVisible,
    setPopoverVisible,
    filterEnabled: Boolean(filterValue),
    popupProps: {
      name,
      rows: rowsForPopup,
      filterValue,
      setFilter,
      field,
      onClose: () => setPopoverVisible(false),
      searchFilter,
      setSearchFilter,
      operator,
      setOperator,
      parentIndex,
    },
  };
}
