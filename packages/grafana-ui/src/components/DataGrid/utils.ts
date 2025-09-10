import { SortColumn } from 'react-data-grid';

import { DataFrame, Field, FieldType } from '@grafana/data';

import { ColumnTypes, Comparator, TableRow } from './types';

/**
 * @internal
 */
export const getDisplayName = (field: Field): string => field.state?.displayName ?? field.name;

/**
 * @internal
 */
export const frameToRecords = (frame: DataFrame): TableRow[] => {
  const fnBody = `
    const rows = Array(frame.length);
    const values = frame.fields.map(f => f.values);
    let rowCount = 0;
    for (let i = 0; i < frame.length; i++) {
      rows[rowCount] = {
        __depth: 0,
        __index: i,
        ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(getDisplayName(field))}: values[${fieldIdx}][i]`).join(',')}
      };
      rowCount += 1;
      if (rows[rowCount-1]['__nestedFrames']){
        const childFrame = rows[rowCount-1]['__nestedFrames'];
        rows[rowCount] = {__depth: 1, __index: i, data: childFrame[0]}
        rowCount += 1;
      }
    }
    return rows;
  `;

  // Creates a function that converts a DataFrame into an array of TableRows
  // Uses new Function() for performance as it's faster than creating rows using loops
  const convert = new Function('frame', fnBody);
  return convert(frame);
};

/* ----------------------------- Data grid comparator ---------------------------- */
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
 * returns a map of column types by display name
 */
export function getColumnTypes(fields: Field[]): ColumnTypes {
  return fields.reduce<ColumnTypes>((acc, field) => {
    switch (field.type) {
      case FieldType.nestedFrames:
        return { ...acc, ...getColumnTypes(field.values[0]?.[0]?.fields ?? []) };
      default:
        return { ...acc, [getDisplayName(field)]: field.type };
    }
  }, {});
}

export function applySort(
  rows: TableRow[],
  fields: Field[],
  sortColumns: SortColumn[],
  columnTypes: ColumnTypes = getColumnTypes(fields)
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

  // Regular sort for tables without nesting
  return [...rows].sort(compareRows);
}
