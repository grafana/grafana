import moment from 'moment'; // eslint-disable-line no-restricted-imports

import { FieldType } from '@grafana/data';

/**
 * Detects the field type from an array of values.
 */
export const detectFieldType = (values: unknown[]): FieldType => {
  // If all values are null, default to strings.
  if (values.every((_) => _ === null)) {
    return FieldType.string;
  }

  // If all values are valid ISO 8601, then assume that it's a time field.
  const isValidISO = values
    .filter((value) => value !== null)
    .every((value) => {
      return moment(String(value).replace(/\.\d+Z$/g, 'Z'), [moment.defaultFormat, 'YYYY-MM-DD'], true).isValid();
    });

  if (isValidISO) {
    return FieldType.time;
  }

  if (values.every((value) => typeof value === 'number')) {
    return FieldType.number;
  }

  if (values.every((value) => typeof value === 'boolean')) {
    return FieldType.boolean;
  }

  return FieldType.string;
};
