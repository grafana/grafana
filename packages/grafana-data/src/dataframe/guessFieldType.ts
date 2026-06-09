import { isBoolean, isNumber, isString } from 'lodash';

import { isDateTime } from '../datetime/moment_wrapper';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';

// PapaParse Dynamic Typing regex:
// https://github.com/mholt/PapaParse/blob/master/papaparse.js#L998
const NUMBER = /^\s*(-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?|NAN)\s*$/i;

/**
 * Given a name and value, this will pick a reasonable field type
 */
export function guessFieldTypeFromNameAndValue(name: string, v: unknown): FieldType {
  if (name) {
    name = name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }
  return guessFieldTypeFromValue(v);
}

/**
 * Check the field type to see what the contents are
 */
export function getFieldTypeFromValue(v: unknown): FieldType {
  if (v instanceof Date || isDateTime(v)) {
    return FieldType.time;
  }

  if (isNumber(v)) {
    return FieldType.number;
  }

  if (isString(v)) {
    return FieldType.string;
  }

  if (isBoolean(v)) {
    return FieldType.boolean;
  }

  return FieldType.other;
}

/**
 * Given a value this will guess the best column type
 *
 * NOTE: this is will try to see if string values can be mapped to other types (like number)
 */
export function guessFieldTypeFromValue(v: unknown): FieldType {
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
    const v = field.values[i];
    if (v != null) {
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
