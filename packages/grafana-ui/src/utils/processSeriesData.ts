// Libraries
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isBoolean from 'lodash/isBoolean';
import moment from 'moment';

import Papa, { ParseError, ParseMeta } from 'papaparse';

// Types
import { SeriesData, Field, TimeSeries, FieldType, TableData } from '../types/index';

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
 * @param series (immutable)
 * @returns a series that has equal length rows, or the same
 * series if no changes were needed
 */
export function matchRowSizes(series: SeriesData): SeriesData {
  const { rows } = series;
  let { fields } = series;

  let sameSize = true;
  let size = fields.length;
  rows.forEach(row => {
    if (size !== row.length) {
      sameSize = false;
      size = Math.max(size, row.length);
    }
  });
  if (sameSize) {
    return series;
  }

  // Pad Fields
  if (size !== fields.length) {
    const diff = size - fields.length;
    fields = [...fields];
    for (let i = 0; i < diff; i++) {
      fields.push({
        name: 'Field ' + (fields.length + 1),
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
    fields,
    rows: fixedRows,
  };
}

function makeFields(values: any[]): Field[] {
  return values.map((value, index) => {
    if (!value) {
      value = 'Field ' + (index + 1);
    }
    return {
      name: value.toString().trim(),
    };
  });
}

/**
 * Convert CSV text into a valid SeriesData object
 *
 * @param text
 * @param options
 * @param details, if exists the result will be filled with debugging details
 */
export function parseCSV(text: string, options?: TableParseOptions, details?: TableParseDetails): SeriesData {
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
      fields: [],
      rows: [],
    };
  }

  // Assume the first line is the header unless the config says its not
  const headerIsNotFirstLine = options && options.headerIsFirstLine === false;
  const header = headerIsNotFirstLine ? [] : results.data.shift();

  return matchRowSizes({
    fields: makeFields(header),
    rows: results.data,
  });
}

function convertTableToSeriesData(table: TableData): SeriesData {
  return {
    // rename the 'text' to 'name' field
    fields: table.columns.map(c => {
      const { text, ...field } = c;
      const f = field as Field;
      f.name = text;
      return f;
    }),
    rows: table.rows,
  };
}

function convertTimeSeriesToSeriesData(timeSeries: TimeSeries): SeriesData {
  return {
    name: timeSeries.target,
    fields: [
      {
        name: timeSeries.target || 'Value',
        unit: timeSeries.unit,
      },
      {
        name: 'Time',
        type: FieldType.time,
        unit: 'dateTimeAsIso',
      },
    ],
    rows: timeSeries.datapoints,
  };
}

export const getFirstTimeField = (series: SeriesData): number => {
  const { fields } = series;
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].type === FieldType.time) {
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
export function guessFieldTypeFromValue(v: any): FieldType {
  if (isNumber(v)) {
    return FieldType.number;
  }

  if (isString(v)) {
    if (NUMBER.test(v)) {
      return FieldType.number;
    }

    if (v === 'true' || v === 'TRUE' || v === 'True' || v === 'false' || v === 'FALSE' || v === 'False') {
      return FieldType.boolean;
    }

    return FieldType.string;
  }

  if (isBoolean(v)) {
    return FieldType.boolean;
  }

  if (v instanceof Date || v instanceof moment) {
    return FieldType.time;
  }

  return FieldType.other;
}

/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
function guessFieldTypeFromTable(series: SeriesData, index: number): FieldType | undefined {
  const column = series.fields[index];

  // 1. Use the column name to guess
  if (column.name) {
    const name = column.name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < series.rows.length; i++) {
    const v = series.rows[i][index];
    if (v !== null) {
      return guessFieldTypeFromValue(v);
    }
  }

  // Could not find anything
  return undefined;
}

/**
 * @returns a copy of the series with the best guess for each field type
 * If the series already has field types defined, they will be used
 */
export const guessFieldTypes = (series: SeriesData): SeriesData => {
  for (let i = 0; i < series.fields.length; i++) {
    if (!series.fields[i].type) {
      // Somethign is missing a type return a modified copy
      return {
        ...series,
        fields: series.fields.map((field, index) => {
          if (field.type) {
            return field;
          }
          // Replace it with a calculated version
          return {
            ...field,
            type: guessFieldTypeFromTable(series, index),
          };
        }),
      };
    }
  }
  // No changes necessary
  return series;
};

export const isTableData = (data: any): data is SeriesData => data && data.hasOwnProperty('columns');

export const isSeriesData = (data: any): data is SeriesData => data && data.hasOwnProperty('fields');

export const toSeriesData = (data: any): SeriesData => {
  if (data.hasOwnProperty('fields')) {
    return data as SeriesData;
  }
  if (data.hasOwnProperty('datapoints')) {
    return convertTimeSeriesToSeriesData(data);
  }
  if (data.hasOwnProperty('columns')) {
    return convertTableToSeriesData(data);
  }
  // TODO, try to convert JSON/Array to seriesta?
  console.warn('Can not convert', data);
  throw new Error('Unsupported data format');
};

export function sortSeriesData(data: SeriesData, sortIndex?: number, reverse = false): SeriesData {
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
