// Libraries
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isBoolean from 'lodash/isBoolean';
import moment from 'moment';

// Types
import { SeriesData, Field, TimeSeries, FieldType, TableData } from '../types/index';

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
    refId: table.refId,
    meta: table.meta,
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

  if (v instanceof Date || v instanceof moment) {
    return FieldType.time;
  }

  return FieldType.other;
}

/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
export function guessFieldTypeFromSeries(series: SeriesData, index: number): FieldType | undefined {
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
            type: guessFieldTypeFromSeries(series, index),
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

export const toLegacyResponseData = (series: SeriesData): TimeSeries | TableData => {
  const { fields, rows } = series;

  if (fields.length === 2) {
    const type = guessFieldTypeFromSeries(series, 1);
    if (type === FieldType.time) {
      return {
        target: fields[0].name || series.name,
        datapoints: rows,
        unit: fields[0].unit,
        refId: series.refId,
        meta: series.meta,
      } as TimeSeries;
    }
  }

  return {
    columns: fields.map(f => {
      return {
        text: f.name,
        filterable: f.filterable,
        unit: f.unit,
        refId: series.refId,
        meta: series.meta,
      };
    }),
    rows,
  };
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

export interface IndexedField extends Field {
  index: number;
}

export class SeriesFieldProcessor {
  private series: SeriesData;
  private fields: Field[];
  private fieldIndexByName: { [key: string]: number };
  private fieldIndexByType: { [key: string]: number[] };

  constructor(series: SeriesData) {
    this.series = series;
    this.fields = [];
    this.fieldIndexByName = {};
    this.fieldIndexByType = {};
    this.fieldIndexByType[FieldType.time] = [];
    this.fieldIndexByType[FieldType.string] = [];
    this.fieldIndexByType[FieldType.number] = [];
    this.fieldIndexByType[FieldType.boolean] = [];
    this.fieldIndexByType[FieldType.other] = [];
    this.process();
  }

  private process() {
    for (let n = 0; n < this.series.fields.length; n++) {
      const field = this.series.fields[n];
      this.processField(field, n);
    }
  }

  private processField(field: Field, index: number) {
    if (field.type !== undefined && field.type !== FieldType.other) {
      this.fields.push(field);
      this.fieldIndexByName[field.name] = index;
      this.fieldIndexByType[field.type].push(index);
      return;
    }

    field = this.guessFieldType(field, index);
    if (field.type === FieldType.other) {
      this.fields.push(field);
      this.fieldIndexByName[field.name] = index;
      this.fieldIndexByType[field.type].push(index);
    } else {
      this.processField(field, index);
    }
  }

  protected guessFieldType(field: Field, index: number): Field {
    const fieldType = guessFieldTypeFromSeries(this.series, index);
    if (fieldType === undefined || fieldType === FieldType.other) {
      field.type = FieldType.other;
      return field;
    }

    field.type = fieldType;
    return field;
  }

  hasFieldOfType(type: FieldType): boolean {
    return this.fieldIndexByType[type] && this.fieldIndexByType[type].length > 0;
  }

  getFields(type?: FieldType): IndexedField[] {
    const fields: IndexedField[] = [];
    for (let index = 0; index < this.fields.length; index++) {
      const field = this.fields[index];

      if (!type || field.type === type) {
        fields.push({ ...field, index });
      }
    }

    return fields;
  }

  getFieldByIndex(index: number): IndexedField | null {
    return this.fields[0] ? { ...this.fields[0], index } : null;
  }

  getFirstFieldOfType(type: FieldType): IndexedField | null {
    return this.hasFieldOfType(type)
      ? { ...this.fields[this.fieldIndexByType[type][0]], index: this.fieldIndexByType[type][0] }
      : null;
  }

  hasFieldNamed(name: string): boolean {
    return this.fieldIndexByName[name] !== undefined;
  }

  getFieldNamed(name: string): IndexedField | null {
    return this.hasFieldNamed(name)
      ? { ...this.fields[this.fieldIndexByName[name]], index: this.fieldIndexByName[name] }
      : null;
  }
}
