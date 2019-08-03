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
  FieldDisplayConfig,
  TimeSeriesValue,
} from '../types/index';
import { isDateTime } from './moment_wrapper';

function convertTableToDataFrame(table: TableData): DataFrame {
  const fields = table.columns.map(c => {
    const { text, ...disp } = c;
    return {
      name: text, // rename 'text' to the 'name' field
      display: disp as FieldDisplayConfig,
      values: new Array<any>(),
    };
  });
  // Fill in the field values
  for (const row of table.rows) {
    for (let i = 0; i < fields.length; i++) {
      fields[i].values.push(row[i]);
    }
  }

  return {
    fields,
    refId: table.refId,
    meta: table.meta,
    name: table.name,
  };
}

function convertTimeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
  const fields = [
    {
      name: timeSeries.target || 'Value',
      type: FieldType.number,
      display: {
        unit: timeSeries.unit,
      },
      values: [] as TimeSeriesValue[],
    },
    {
      name: 'Time',
      type: FieldType.time,
      display: {
        unit: 'dateTimeAsIso',
      },
      values: [] as number[],
    },
  ];

  for (const point of timeSeries.datapoints) {
    fields[0].values.push(point[0]);
    fields[1].values.push(point[1]);
  }

  return {
    name: timeSeries.target,
    fields,
    labels: timeSeries.tags,
    refId: timeSeries.refId,
    meta: timeSeries.meta,
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
    const v = field.values[i];
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
          if (field.type) {
            return field;
          }
          // Calculate a reasonable schema value
          return {
            ...field,
            type: guessFieldTypeForField(field),
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
    return data as DataFrame;
  }
  if (data.hasOwnProperty('datapoints')) {
    return convertTimeSeriesToDataFrame(data);
  }
  if (data.hasOwnProperty('columns')) {
    return convertTableToDataFrame(data);
  }
  // TODO, try to convert JSON/Array to seriesta?
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
      row.push(fields[j].values[i]);
    }
    rows.push(row);
  }

  if (fields.length === 2) {
    let type = fields[1].type;
    if (!type) {
      type = guessFieldTypeForField(fields[1]);
    }
    if (type === FieldType.time) {
      return {
        alias: fields[0].name || frame.name,
        target: fields[0].name || frame.name,
        datapoints: rows,
        unit: fields[0].display ? fields[0].display.unit : undefined,
        refId: frame.refId,
        meta: frame.meta,
      } as TimeSeries;
    }
  }

  return {
    columns: fields.map(f => {
      const { name, display } = f;
      if (display) {
        // keep unit etc
        const { ...column } = display;
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
  if (isNumber(sortIndex)) {
    if (true) {
      console.log('TODO, sort by column!!!');
    }

    const copy = {
      ...data,
      // rows: [...data.rows].sort((a, b) => {
      //   a = a[sortIndex];
      //   b = b[sortIndex];
      //   // Sort null or undefined separately from comparable values
      //   return +(a == null) - +(b == null) || +(a > b) || -(a < b);
      // }),
    };

    if (reverse) {
      //copy.rows.reverse();
    }

    return copy;
  }
  return data;
}
