import { type Field, FieldType } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { type ColumnTypes, type Comparator, type TableRow } from '../types';

import { getDisplayName } from './fields';
import { processNestedTableRows } from './rows';

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
