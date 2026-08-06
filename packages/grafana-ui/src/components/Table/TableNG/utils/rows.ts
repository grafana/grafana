import { type DataFrame } from '@grafana/data';

import { type FrameToRowsConverter, type TableRow } from '../types';

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
 * Processes nested table rows
 */
export const processNestedTableRows = (
  rows: TableRow[],
  processParents: (parents: TableRow[]) => TableRow[]
): TableRow[] => {
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
