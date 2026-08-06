import { type Field, formattedValueToString } from '@grafana/data';

import { type ApplyFilterResult, type FilterType, type TableRow } from '../types';

import { getDisplayName } from './fields';
import { processNestedTableRows } from './rows';

/**
 * @internal
 * Applies active filters to `rows` and computes cross-filter metadata for filter popup UIs.
 *
 * Filters are chained sequentially so that for each filter key, `crossFilterRows[key]`
 * holds the rows available *before* that filter was applied (i.e. the rows that passed all
 * preceding filters in the same scope). `crossFilterTailRows` holds the rows that survive
 * *all* filters — used for new filters that have not yet been applied.
 *
 * `filteredRows` is the display-ready result: equal to `crossFilterTailRows` for flat tables,
 * or wrapped with `processNestedTableRows` to preserve parent-child structure when
 * `hasNestedFrames` is true.
 *
 * When called for a nested table instance, pass `parentIndex` to scope filters to that level.
 */
export function applyFilter(
  rows: TableRow[],
  filter: FilterType,
  fields: Field[],
  hasNestedFrames?: boolean,
  parentIndex?: number
): ApplyFilterResult {
  // Scope rows to the relevant nesting level
  const isNested = parentIndex !== undefined;
  const scopedRows = !isNested ? rows.filter((r) => r.__depth === 0) : rows;

  // Collect filter keys that belong to this scope (preserving JS insertion order)
  const crossFilterOrder = Object.keys(filter).filter((key) => {
    const entry = filter[key];
    return !isNested ? entry.parentIndex == null : entry.parentIndex === parentIndex;
  });

  const crossFilterRows: Record<string, TableRow[]> = {};
  let crossFilterTailRows = scopedRows;

  for (const filterKey of crossFilterOrder) {
    const filterEntry = filter[filterKey];
    // Store rows available *before* this filter is applied
    crossFilterRows[filterKey] = crossFilterTailRows;
    // Advance the chain by applying this filter
    crossFilterTailRows = crossFilterTailRows.filter((row) => {
      const field = fields.find((f) => getDisplayName(f) === filterEntry.displayName);
      if (!field || !field.display) {
        return true;
      }
      const displayedValue = formattedValueToString(field.display(row[filterEntry.displayName]));
      return filterEntry.filteredSet.has(displayedValue);
    });
  }

  // For nested frames, wrap with processNestedTableRows so parent rows that have matching
  // children are preserved for the expander UI. Use a Set for O(1) membership checks.
  let filteredRows = crossFilterTailRows;
  if (hasNestedFrames) {
    const tailSet = new Set(crossFilterTailRows);
    filteredRows = processNestedTableRows(rows, (parents) => parents.filter((row) => tailSet.has(row)));
  }

  return { crossFilterOrder, crossFilterRows, crossFilterTailRows, filteredRows };
}
