// Libraries
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isBoolean from 'lodash/isBoolean';

// Types
import {
  DataFrame,
  Field,
  TimeSeries,
  FieldType,
  TableData,
  Column,
  FieldConfig,
  TimeSeriesValue,
  DataFrameJSON,
  FieldJSON,
} from '../types/index';
import { isDateTime } from './moment_wrapper';
import { ArrayVector, SortedVector } from './vector';
import { DataFrameHelper } from './dataFrameHelper';

function convertTableToDataFrame(table: TableData): DataFrame {
  const fields = table.columns.map(c => {
    const { text, ...disp } = c;
    return {
      name: text, // rename 'text' to the 'name' field
      config: (disp || {}) as FieldConfig,
      values: new ArrayVector(),
      type: FieldType.other,
    };
  });
  // Fill in the field values
  for (const row of table.rows) {
    for (let i = 0; i < fields.length; i++) {
      fields[i].values.buffer.push(row[i]);
    }
  }
  for (const f of fields) {
    const t = guessFieldTypeForField(f);
    if (t) {
      f.type = t;
    }
  }

  return {
    fields,
    refId: table.refId,
    meta: table.meta,
    name: table.name,
    length: fields[0].values.length,
  };
}

function convertTimeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
  const fields = [
    {
      name: timeSeries.target || 'Value',
      type: FieldType.number,
      config: {
        unit: timeSeries.unit,
      },
      values: new ArrayVector<TimeSeriesValue>(),
    },
    {
      name: 'Time',
      type: FieldType.time,
      config: {
        unit: 'dateTimeAsIso',
      },
      values: new ArrayVector<number>(),
    },
  ];

  for (const point of timeSeries.datapoints) {
    fields[0].values.buffer.push(point[0]);
    fields[1].values.buffer.push(point[1]);
  }

  return {
    name: timeSeries.target,
    labels: timeSeries.tags,
    refId: timeSeries.refId,
    meta: timeSeries.meta,
    fields,
    length: timeSeries.datapoints.length,
  };
}

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

  if (v instanceof Date || isDateTime(v)) {
    return FieldType.time;
  }

  return FieldType.other;
}

/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
export function guessFieldTypeForField(field: Field): FieldType | undefined {
  // 1. Use the column name to guess
  if (field.name) {
    const name = field.name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < field.values.length; i++) {
    const v = field.values.get(i);
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
export const guessFieldTypes = (series: DataFrame): DataFrame => {
  for (let i = 0; i < series.fields.length; i++) {
    if (!series.fields[i].type) {
      // Somethign is missing a type return a modified copy
      return {
        ...series,
        fields: series.fields.map(field => {
          if (field.type && field.type !== FieldType.other) {
            return field;
          }
          // Calculate a reasonable schema value
          return {
            ...field,
            type: guessFieldTypeForField(field) || FieldType.other,
          };
        }),
      };
    }
  }
  // No changes necessary
  return series;
};

export const isTableData = (data: any): data is DataFrame => data && data.hasOwnProperty('columns');

export const isDataFrame = (data: any): data is DataFrame => data && data.hasOwnProperty('fields');

export const toDataFrame = (data: any): DataFrame => {
  if (data.hasOwnProperty('fields')) {
    // @deprecated -- remove after 6.4
    if (data.hasOwnProperty('rows')) {
      throw new Error('Old DataFrame format.  Values should be on the fields');
    }

    // Check if each field has
    const fields = data.fields as Array<Field | FieldJSON>;
    if (fields.length > 0) {
      for (const f of fields) {
        if (f.hasOwnProperty('values')) {
          return data as DataFrame;
        }
      }
    }
    // Converts 'buffer' to DataFrame
    return new DataFrameHelper(data as DataFrameJSON);
  }
  if (data.hasOwnProperty('datapoints')) {
    return convertTimeSeriesToDataFrame(data);
  }
  if (data.hasOwnProperty('columns')) {
    return convertTableToDataFrame(data);
  }
  // TODO, try to convert JSON/Array to table?
  console.warn('Can not convert', data);
  throw new Error('Unsupported data format');
};

export const toLegacyResponseData = (frame: DataFrame): TimeSeries | TableData => {
  const { fields } = frame;

  const length = fields[0].values.length;
  const rows: any[][] = [];
  for (let i = 0; i < length; i++) {
    const row: any[] = [];
    for (let j = 0; j < fields.length; j++) {
      row.push(fields[j].values.get(i));
    }
    rows.push(row);
  }

  if (fields.length === 2) {
    let type = fields[1].type;
    if (!type) {
      type = guessFieldTypeForField(fields[1]) || FieldType.other;
    }
    if (type === FieldType.time) {
      return {
        alias: fields[0].name || frame.name,
        target: fields[0].name || frame.name,
        datapoints: rows,
        unit: fields[0].config ? fields[0].config.unit : undefined,
        refId: frame.refId,
        meta: frame.meta,
      } as TimeSeries;
    }
  }

  return {
    columns: fields.map(f => {
      const { name, config } = f;
      if (config) {
        // keep unit etc
        const { ...column } = config;
        (column as Column).text = name;
        return column as Column;
      }
      return { text: name };
    }),
    refId: frame.refId,
    meta: frame.meta,
    rows,
  };
};

export function sortDataFrame(data: DataFrame, sortIndex?: number, reverse = false): DataFrame {
  const field = data.fields[sortIndex!];
  if (!field) {
    return data;
  }

  // Natural order
  const index: number[] = [];
  for (let i = 0; i < data.length; i++) {
    index.push(i);
  }
  const values = field.values;

  // Numeric Comparison
  let compare = (a: number, b: number) => {
    const vA = values.get(a);
    const vB = values.get(b);
    return vA - vB; // works for numbers!
  };

  // String Comparison
  if (field.type === FieldType.string) {
    compare = (a: number, b: number) => {
      const vA: string = values.get(a);
      const vB: string = values.get(b);
      return vA.localeCompare(vB);
    };
  }

  // Run the sort function
  index.sort(compare);
  if (reverse) {
    index.reverse();
  }

  // Return a copy that maps sorted values
  return {
    ...data,
    fields: data.fields.map(f => {
      return {
        ...f,
        values: new SortedVector(f.values, index),
      };
    }),
  };
}

/**
 * Returns a copy that does not include functions
 */
export function dataFrameToJSON(data: DataFrame): DataFrameJSON {
  const fields: FieldJSON[] = data.fields.map(f => {
    return {
      name: f.name,
      type: f.type,
      config: f.config,
      buffer: f.values.toArray(),
    };
  });

  return {
    fields,
    refId: data.refId,
    meta: data.meta,
    name: data.name,
    labels: data.labels,
  };
}
