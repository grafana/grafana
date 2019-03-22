// Libraries
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isBoolean from 'lodash/isBoolean';
import moment from 'moment';

import Papa, { ParseError, ParseMeta } from 'papaparse';

// Types
import { TableData, Column, TimeSeries, ColumnType } from '../types';

// Subset of all parse options
export interface TableParseOptions {
  headerIsFirstLine?: boolean; // Not a papa-parse option
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: ""
  comments?: boolean | string; // default: false
}

export interface TableParseDetails {
  meta?: ParseMeta;
  errors?: ParseError[];
}

/**
 * This makes sure the header and all rows have equal length.
 *
 * @param table (immutable)
 * @returns a new table that has equal length rows, or the same
 * table if no changes were needed
 */
export function matchRowSizes(table: TableData): TableData {
  const { rows } = table;
  let { columns } = table;

  let sameSize = true;
  let size = columns.length;
  rows.forEach(row => {
    if (size !== row.length) {
      sameSize = false;
      size = Math.max(size, row.length);
    }
  });
  if (sameSize) {
    return table;
  }

  // Pad Columns
  if (size !== columns.length) {
    const diff = size - columns.length;
    columns = [...columns];
    for (let i = 0; i < diff; i++) {
      columns.push({
        text: 'Column ' + (columns.length + 1),
      });
    }
  }

  // Pad Rows
  const fixedRows: any[] = [];
  rows.forEach(row => {
    const diff = size - row.length;
    if (diff > 0) {
      row = [...row];
      for (let i = 0; i < diff; i++) {
        row.push(null);
      }
    }
    fixedRows.push(row);
  });

  return {
    columns,
    rows: fixedRows,
  };
}

function makeColumns(values: any[]): Column[] {
  return values.map((value, index) => {
    if (!value) {
      value = 'Column ' + (index + 1);
    }
    return {
      text: value.toString().trim(),
    };
  });
}

/**
 * Convert CSV text into a valid TableData object
 *
 * @param text
 * @param options
 * @param details, if exists the result will be filled with debugging details
 */
export function parseCSV(text: string, options?: TableParseOptions, details?: TableParseDetails): TableData {
  const results = Papa.parse(text, { ...options, dynamicTyping: true, skipEmptyLines: true });
  const { data, meta, errors } = results;

  // Fill the parse details for debugging
  if (details) {
    details.errors = errors;
    details.meta = meta;
  }

  if (!data || data.length < 1) {
    // Show a more reasonable warning on empty input text
    if (details && !text) {
      errors.length = 0;
      errors.push({
        code: 'empty',
        message: 'Empty input text',
        type: 'warning',
        row: 0,
      });
      details.errors = errors;
    }
    return {
      columns: [],
      rows: [],
    };
  }

  // Assume the first line is the header unless the config says its not
  const headerIsNotFirstLine = options && options.headerIsFirstLine === false;
  const header = headerIsNotFirstLine ? [] : results.data.shift();

  return matchRowSizes({
    columns: makeColumns(header),
    rows: results.data,
  });
}

function convertTimeSeriesToTableData(timeSeries: TimeSeries): TableData {
  return {
    name: timeSeries.target,
    columns: [
      {
        text: timeSeries.target || 'Value',
        unit: timeSeries.unit,
      },
      {
        text: 'Time',
        type: ColumnType.time,
        unit: 'dateTimeAsIso',
      },
    ],
    rows: timeSeries.datapoints,
  };
}

export const getFirstTimeColumn = (table: TableData): number => {
  const { columns } = table;
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].type === ColumnType.time) {
      return i;
    }
  }
  return -1;
};

// PapaParse Dynamic Typing regex:
// https://github.com/mholt/PapaParse/blob/master/papaparse.js#L998
const NUMBER = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

/**
 * Given a value this will guess the best column type
 *
 * TODO: better Date/Time support!  Look for standard date strings?
 */
export function guessColumnTypeFromValue(v: any, parseString?: boolean): ColumnType {
  if (isNumber(v)) {
    return ColumnType.number;
  }

  if (isString(v)) {
    if (parseString) {
      const c0 = v[0].toLowerCase();
      if (c0 === 't' || c0 === 'f') {
        if (v === 'true' || v === 'TRUE' || v === 'True' || v === 'false' || v === 'FALSE' || v === 'False') {
          return ColumnType.boolean;
        }
      }

      if (NUMBER.test(v)) {
        return ColumnType.number;
      }
    }
    return ColumnType.string;
  }

  if (isBoolean(v)) {
    return ColumnType.boolean;
  }

  if (v instanceof Date || v instanceof moment) {
    return ColumnType.time;
  }

  return ColumnType.other;
}

/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
function guessColumnTypeFromTable(table: TableData, index: number, parseString?: boolean): ColumnType | undefined {
  const column = table.columns[index];

  // 1. Use the column name to guess
  if (column.text) {
    const name = column.text.toLowerCase();
    if (name === 'date' || name === 'time') {
      return ColumnType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < table.rows.length; i++) {
    const v = table.rows[i][index];
    if (v !== null) {
      return guessColumnTypeFromValue(v, parseString);
    }
  }

  // Could not find anything
  return undefined;
}

/**
 * @returns a table Returns a copy of the table with the best guess for each column type
 * If the table already has column types defined, they will be used
 */
export const guessColumnTypes = (table: TableData): TableData => {
  for (let i = 0; i < table.columns.length; i++) {
    if (!table.columns[i].type) {
      // Somethign is missing a type return a modified copy
      return {
        ...table,
        columns: table.columns.map((column, index) => {
          if (column.type) {
            return column;
          }
          // Replace it with a calculated version
          return {
            ...column,
            type: guessColumnTypeFromTable(table, index),
          };
        }),
      };
    }
  }
  // No changes necessary
  return table;
};

export const isTableData = (data: any): data is TableData => data && data.hasOwnProperty('columns');

export const toTableData = (data: any): TableData => {
  if (data.hasOwnProperty('columns')) {
    return data as TableData;
  }
  if (data.hasOwnProperty('datapoints')) {
    return convertTimeSeriesToTableData(data);
  }
  // TODO, try to convert JSON/Array to table?
  console.warn('Can not convert', data);
  throw new Error('Unsupported data format');
};

export function sortTableData(data: TableData, sortIndex?: number, reverse = false): TableData {
  if (isNumber(sortIndex)) {
    const copy = {
      ...data,
      rows: [...data.rows].sort((a, b) => {
        a = a[sortIndex];
        b = b[sortIndex];
        // Sort null or undefined separately from comparable values
        return +(a == null) - +(b == null) || +(a > b) || -(a < b);
      }),
    };

    if (reverse) {
      copy.rows.reverse();
    }

    return copy;
  }
  return data;
}
