import { DataFrame, Field, FieldType, FieldDTO, DataFrameDTO } from '../types/dataFrame';
import { vectorToArray } from '../vector/vectorToArray';
import { isBoolean, isNumber, isString } from 'lodash';

export function isTimeSerie(frame: DataFrame) {
  if (frame.fields.length > 2) {
    return false;
  }
  return Boolean(frame.fields.find((field) => field.type === FieldType.time));
}

export function isTimeSeries(data: DataFrame[]) {
  return !data.find((frame) => !isTimeSerie(frame));
}

/**
 * Indicates if there is any time field in the array of data frames
 * @param data
 */
export function anySeriesWithTimeField(data: DataFrame[]) {
  for (let i = 0; i < data.length; i++) {
    const timeField = getTimeField(data[i]);
    if (timeField.timeField !== undefined && timeField.timeIndex !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a copy that does not include functions
 */
export function toDataFrameDTO(data: DataFrame): DataFrameDTO {
  const fields: FieldDTO[] = data.fields.map((f) => {
    let values = f.values.toArray();
    // The byte buffers serialize like objects
    if (values instanceof Float64Array) {
      values = vectorToArray(f.values);
    }
    return {
      name: f.name,
      type: f.type,
      config: f.config,
      values,
      labels: f.labels,
    };
  });

  return {
    fields,
    refId: data.refId,
    meta: data.meta,
    name: data.name,
  };
}

// PapaParse Dynamic Typing regex:
// https://github.com/mholt/PapaParse/blob/master/papaparse.js#L998
const NUMBER = /^\s*(-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?|NAN)\s*$/i;

/**
 * Given a name and value, this will pick a reasonable field type
 */
export function guessFieldTypeFromNameAndValue(name: string, v: any): FieldType {
  if (name) {
    name = name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }
  return guessFieldTypeFromValue(v);
}

/**
 * Given a value this will guess the best column type
 *
 * TODO: better Date/Time support!  Look for standard date strings?
 */
export function guessFieldTypeFromValue(v: any): FieldType {
  if (v instanceof Date || isDateTime(v)) {
    return FieldType.time;
  }

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
 * @returns A copy of the series with the best guess for each field type.
 * If the series already has field types defined, they will be used, unless `guessDefined` is true.
 * @param series The DataFrame whose field's types should be guessed
 * @param guessDefined Whether to guess types of fields with already defined types
 */
export const guessFieldTypes = (series: DataFrame, guessDefined = false): DataFrame => {
  for (const field of series.fields) {
    if (!field.type || field.type === FieldType.other || guessDefined) {
      // Something is missing a type, return a modified copy
      return {
        ...series,
        fields: series.fields.map((field) => {
          if (field.type && field.type !== FieldType.other && !guessDefined) {
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

export const getTimeField = (series: DataFrame): { timeField?: Field; timeIndex?: number } => {
  for (let i = 0; i < series.fields.length; i++) {
    if (series.fields[i].type === FieldType.time) {
      return {
        timeField: series.fields[i],
        timeIndex: i,
      };
    }
  }
  return {};
};
