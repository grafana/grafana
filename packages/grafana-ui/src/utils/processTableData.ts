// Libraries
import isNumber from 'lodash/isNumber';
import Papa, { ParseError, ParseMeta } from 'papaparse';

// Types
import { TableData, Column, TimeSeries } from '../types';

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
    columns: [
      {
        text: timeSeries.target || 'Value',
        unit: timeSeries.unit,
      },
      {
        text: 'Time',
        type: 'time',
        unit: 'dateTimeAsIso',
      },
    ],
    rows: timeSeries.datapoints,
  };
}

export const isTableData = (data: any): data is TableData => data && data.hasOwnProperty('columns');

export const toTableData = (results?: any[]): TableData[] => {
  if (!results) {
    return [];
  }

  return results
    .filter(d => !!d)
    .map(data => {
      if (data.hasOwnProperty('columns')) {
        return data as TableData;
      }
      if (data.hasOwnProperty('datapoints')) {
        return convertTimeSeriesToTableData(data);
      }
      // TODO, try to convert JSON to table?
      console.warn('Can not convert', data);
      throw new Error('Unsupported data format');
    });
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
