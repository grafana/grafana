import { TableData, Column } from '../types/index';

import Papa, { ParseError, ParseMeta } from 'papaparse';

// Subset of all parse options
export interface ParseConfig {
  headerIsFirstLine?: boolean; // Not a papa-parse option
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: ""
  comments?: boolean | string; // default: false
}

export interface ParseDetails {
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
    type: table.type,
    columnMap: table.columnMap,
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
 * Convert text into a valid TableData object
 *
 * @param text
 * @param config
 * @param details, if exists the result will be filled with parse details
 */
export function parseCSV(text: string, config?: ParseConfig, details?: ParseDetails): TableData {
  const results = Papa.parse(text, { ...config, dynamicTyping: true, skipEmptyLines: true });
  const { data, meta, errors } = results;

  // Fill the parse details fro debugging
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
      type: 'table',
      columnMap: {},
    };
  }

  // Assume the first line is the header unless the config says its not
  const headerIsNotFirstLine = config && config.headerIsFirstLine === false;
  const header = headerIsNotFirstLine ? [] : results.data.shift();

  return matchRowSizes({
    columns: makeColumns(header),
    rows: results.data,
    type: 'table',
    columnMap: {},
  });
}
