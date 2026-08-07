import { type DataFrame, type Field, FieldType, formattedValueToString } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import {
  type ApplyFilterResult,
  type ColumnTypes,
  type Comparator,
  type FilterType,
  type FrameToRowsConverter,
  type TableRow,
} from '../types';

import { getDisplayName } from './fields';

// Row metadata keys that must never be shadowed by a same-named data column when
// building rows via prototype getters (a column named e.g. "__index" would otherwise
// override the metadata that every cell lookup depends on).
const RESERVED_ROW_KEYS = new Set(['__depth', '__index', '__parentIndex']);

/**
 * @internal
 * Builds a converter that maps a DataFrame (struct-of-arrays) into an array of
 * TableRows (array-of-structs) without eval/`unsafe-eval`.
 *
 * Rather than copying every cell value into each row (which forces V8 to use
 * slow computed-key stores and dominates conversion time on wide frames), each
 * data row is created from a per-frame prototype that exposes one getter per
 * column. The getter reads `frame.fields[col].values[this.__index]` on demand,
 * so construction is O(rows) tiny objects instead of O(rows * cols) writes.
 *
 * The `row[displayName]` access contract is preserved for all consumers (sort,
 * filter, row-height measuring). Note that columns are exposed via the prototype
 * rather than as own properties, so they do not appear in `Object.keys(row)` /
 * `JSON.stringify(row)`; no consumer relies on enumerating row own-keys.
 *
 * @param displayNames The display names of the frame's fields, in the order they are stored in the frame.
 * @param nestedFramesFieldName name of the field that contains nested frames. If provided, an expander placeholder row will be emitted for each non-empty nested frame.
 */
export function compileFrameToRecords(displayNames: string[], nestedFramesFieldName?: string): FrameToRowsConverter {
  const nestedColIdx = nestedFramesFieldName ? displayNames.indexOf(nestedFramesFieldName) : -1;

  return (frame: DataFrame, nestedRowIndex?: number): TableRow[] => {
    const values = frame.fields.map((f) => f.values);
    const frameLength = frame.length ?? values[0]?.length ?? 0;

    // Build a prototype carrying one getter per column. The nested-frames column
    // is intentionally not exposed (it is replaced by an expander placeholder row),
    // and the reserved meta keys are never shadowed by a same-named column so the
    // true row metadata (notably __index, used to resolve every cell) always wins.
    const proto = {
      __depth: -1,
      __index: -1,
      __parentIndex: undefined,
    };
    const descriptors: PropertyDescriptorMap = {};
    for (let j = 0; j < displayNames.length; j++) {
      const name = displayNames[j];
      if (j === nestedColIdx || RESERVED_ROW_KEYS.has(name)) {
        continue;
      }
      const col = values[j];
      descriptors[name] = {
        enumerable: true,
        get(this: TableRow) {
          return col[this.__index];
        },
      };
    }
    Object.defineProperties(proto, descriptors);

    const hasParent = nestedRowIndex != null;
    const nestedValues = nestedColIdx === -1 ? undefined : values[nestedColIdx];

    const createRow = (index: number, depth: number): TableRow => {
      const row: TableRow = Object.create(proto);
      row.__depth = depth;
      row.__index = index;
      if (hasParent) {
        row.__parentIndex = nestedRowIndex;
      }
      return row;
    };

    // Fast path: without a nested-frames column the output is exactly one row
    // per frame entry, so it can be sized up front and written by index.
    if (nestedValues === undefined) {
      const result = Array(frameLength);
      for (let i = 0; i < frameLength; i++) {
        result[i] = createRow(i, 0);
      }
      return result;
    }

    // Nested path: each entry may emit an extra expander placeholder row, so the
    // final length isn't known without inspecting the nested column.
    const rows: TableRow[] = [];
    for (let i = 0; i < frameLength; i++) {
      rows.push(createRow(i, 0));
      if (nestedValues[i]) {
        rows.push({ __depth: 1, __index: i });
      }
    }

    return rows;
  };
}

/**
 * @internal
 * Returns unique key for each row
 */
export function rowKeyGetter(row: TableRow): string {
  return row.__index + '_' + row.__depth;
}

export const getStableRowKey = (rowIndex: number, frame?: DataFrame): string => {
  const key = frame?.meta?.custom?.stableRowKey;
  return key != null ? String(key) : String(rowIndex);
};

/**
 * @internal
 * Processes nested table rows
 */
const processNestedTableRows = (rows: TableRow[], processParents: (parents: TableRow[]) => TableRow[]): TableRow[] => {
  // Separate parent and child rows
  // Array for parentRows: enables sorting and maintains order for iteration
  // Map for childRows: provides O(1) lookup by parent index when reconstructing the result
  const parentRows: TableRow[] = [];
  const childRows: Map<number, TableRow> = new Map();

  for (const row of rows) {
    if (row.__depth === 0) {
      parentRows.push(row);
    } else {
      childRows.set(row.__index, row);
    }
  }

  // Process parent rows (filter or sort)
  const processedParents = processParents(parentRows);

  // Reconstruct the result
  const result: TableRow[] = [];
  for (const row of processedParents) {
    result.push(row);
    const childRow = childRows.get(row.__index);
    if (childRow) {
      result.push(childRow);
    }
  }

  return result;
};

// The numeric: true option is used to sort numbers as strings correctly. It recognizes numeric sequences
// within strings and sorts numerically instead of lexicographically.
const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;
const strCompare: Comparator = (a, b) => compare(String(a ?? ''), String(b ?? ''));
const numCompare: Comparator = (a, b) => {
  if (a === b) {
    return 0;
  }
  if (a == null) {
    return -1;
  }
  if (b == null) {
    return 1;
  }
  return Number(a) - Number(b);
};
const frameCompare: Comparator = (a, b) => {
  // @ts-ignore The compared vals are DataFrameWithValue. the value is the rendered stat (first, last, etc.)
  return (a?.value ?? 0) - (b?.value ?? 0);
};

/**
 * @internal
 */
export function getComparator(sortColumnType: FieldType): Comparator {
  switch (sortColumnType) {
    // Handle sorting for frame type fields (sparklines)
    case FieldType.frame:
      return frameCompare;
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return numCompare;
    case FieldType.string:
    case FieldType.enum:
    default:
      return strCompare;
  }
}

/**
 * @internal
 */
export function applySort(
  rows: TableRow[],
  fields: Field[],
  sortColumns: SortColumn[],
  columnTypes: ColumnTypes,
  hasNestedFrames?: boolean
): TableRow[] {
  if (sortColumns.length === 0) {
    return rows;
  }

  const sortNanos = sortColumns.map(
    (c) => fields.find((f) => f.type === FieldType.time && getDisplayName(f) === c.columnKey)?.nanos
  );

  const compareRows = (a: TableRow, b: TableRow): number => {
    let result = 0;

    for (let i = 0; i < sortColumns.length; i++) {
      const { columnKey, direction } = sortColumns[i];
      const compare = getComparator(columnTypes[columnKey]);
      const sortDir = direction === 'ASC' ? 1 : -1;

      result = sortDir * compare(a[columnKey], b[columnKey]);

      if (result === 0) {
        const nanos = sortNanos[i];

        if (nanos !== undefined) {
          result = sortDir * (nanos[a.__index] - nanos[b.__index]);
        }
      }

      if (result !== 0) {
        break;
      }
    }

    return result;
  };

  return hasNestedFrames
    ? processNestedTableRows(rows, (parents) => parents.sort(compareRows))
    : [...rows].sort(compareRows);
}

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
