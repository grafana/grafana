// Libraries
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isBoolean from 'lodash/isBoolean';
import moment from 'moment';

// Types
import { SeriesData, Field, TimeSeries, FieldType, TableData, IndexedField } from '../types/index';

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

export const getFirstTimeField = (series: SeriesData): number => {
  const { fields } = series;
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].type === FieldType.time) {
      return i;
    }
  }
  return -1;
};

export const getFieldByName = (series: SeriesData, name: string): Field | undefined => {
  const { fields } = series;
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].name === name) {
      return fields[i];
    }
  }
  return undefined;
};

export const hasFieldNamed = (series: SeriesData, name: string): boolean => {
  return getFieldByName(series, name) !== undefined;
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

export class SeriesFieldProcessor {
  series: SeriesData;
  fields: Field[];
  fieldIndexByName: { [key: string]: number };
  timeFieldIndices: number[];
  stringFieldIndices: number[];
  numberFieldIndices: number[];
  booleanFieldIndices: number[];
  otherFieldIndices: number[];

  constructor(series: SeriesData) {
    this.series = series;
    this.fields = [];
    this.fieldIndexByName = {};
    this.timeFieldIndices = [];
    this.stringFieldIndices = [];
    this.numberFieldIndices = [];
    this.booleanFieldIndices = [];
    this.otherFieldIndices = [];
    this.process();
  }

  private process() {
    for (let n = 0; n < this.series.fields.length; n++) {
      const field = this.series.fields[n];
      this.processField(field, n);
    }
  }

  private processField(field: Field, index: number) {
    switch (field.type) {
      case FieldType.time:
        this.fields.push(field);
        this.fieldIndexByName[field.name] = index;
        this.timeFieldIndices.push(index);
        return;
      case FieldType.string:
        this.fields.push(field);
        this.fieldIndexByName[field.name] = index;
        this.stringFieldIndices.push(index);
        return;
      case FieldType.number:
        this.fields.push(field);
        this.fieldIndexByName[field.name] = index;
        this.numberFieldIndices.push(index);
        return;
      case FieldType.boolean:
        this.fields.push(field);
        this.fieldIndexByName[field.name] = index;
        this.booleanFieldIndices.push(index);
        return;
    }

    field = this.guessFieldType(field, index);
    if (field.type === FieldType.other) {
      this.fields.push(field);
      this.fieldIndexByName[field.name] = index;
      this.otherFieldIndices.push(index);
    } else {
      this.processField(field, index);
    }
  }

  protected guessFieldType(field: Field, index: number): Field {
    if (field.type === FieldType.other) {
      const fieldType = guessFieldTypeFromSeries(this.series, index);
      if (fieldType === undefined || fieldType === FieldType.other) {
        return field;
      }

      field.type = fieldType;
    }

    return field;
  }

  hasTimeField(): boolean {
    return this.timeFieldIndices.length > 0;
  }

  hasStringField(): boolean {
    return this.stringFieldIndices.length > 0;
  }

  hasNumberField(): boolean {
    return this.numberFieldIndices.length > 0;
  }

  hasBooleanField(): boolean {
    return this.booleanFieldIndices.length > 0;
  }

  getFields(type?: FieldType): IndexedField[] {
    switch (type) {
      case FieldType.time:
        return this.getTimeFields();
      case FieldType.string:
        return this.getStringFields();
      case FieldType.number:
        return this.getNumberFields();
      case FieldType.boolean:
        return this.getBooleanFields();
      case FieldType.other:
        return this.getOtherFields();
      default:
        return this.fields.map((field, index) => {
          return {
            ...field,
            index,
          };
        });
    }
  }

  getTimeFields(): IndexedField[] {
    return this.timeFieldIndices.map(index => {
      return {
        ...this.fields[index],
        index,
      };
    });
  }

  getStringFields(): IndexedField[] {
    return this.stringFieldIndices.map(index => {
      return {
        ...this.fields[index],
        index,
      };
    });
  }

  getNumberFields(): IndexedField[] {
    return this.numberFieldIndices.map(index => {
      return {
        ...this.fields[index],
        index,
      };
    });
  }

  getBooleanFields(): IndexedField[] {
    return this.booleanFieldIndices.map(index => {
      return {
        ...this.fields[index],
        index,
      };
    });
  }

  getOtherFields(): IndexedField[] {
    return this.otherFieldIndices.map(index => {
      return {
        ...this.fields[index],
        index,
      };
    });
  }

  getFirstTimeField(): IndexedField | null {
    return this.timeFieldIndices.length > 0
      ? { ...this.fields[this.timeFieldIndices[0]], index: this.timeFieldIndices[0] }
      : null;
  }

  getFirstStringField(): IndexedField | null {
    return this.stringFieldIndices.length > 0
      ? { ...this.fields[this.stringFieldIndices[0]], index: this.stringFieldIndices[0] }
      : null;
  }

  getFirstNumberField(): IndexedField | null {
    return this.numberFieldIndices.length > 0
      ? { ...this.fields[this.numberFieldIndices[0]], index: this.numberFieldIndices[0] }
      : null;
  }

  getFirstBooleanField(): IndexedField | null {
    return this.booleanFieldIndices.length > 0
      ? { ...this.fields[this.booleanFieldIndices[0]], index: this.booleanFieldIndices[0] }
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
