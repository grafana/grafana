import { map } from 'rxjs/operators';

import { TimeZone } from '@grafana/schema';

import { Field } from '../../types';
import { DataTransformerInfo } from '../../types/transformations';

import { fieldToStringField } from './convertFieldType';
import { DataTransformerID } from './ids';

export interface FormatTimeTransformerOptions {
  timeField: string;
  outputFormat: string;
  timezone: TimeZone;
}

export const formatTimeTransformer: DataTransformerInfo<FormatTimeTransformerOptions> = {
  id: DataTransformerID.formatTime,
  name: 'Format time',
  description: 'Set the output format of a time field',
  defaultOptions: { timeField: '', outputFormat: '', useTimezone: true },
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        // If a field and a format are configured
        // then format the time output
        const formatter = createTimeFormatter(options.timeField, options.outputFormat, options.timezone);

        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: formatter(frame.fields),
        }));
      })
    ),
};

/**
 * @internal
 */
export const createTimeFormatter = (timeField: string, outputFormat: string, timezone: string) => (fields: Field[]) => {
  return fields.map((field) => {
    // Find the configured field
    if (field.name === timeField) {
      // Update values to use the configured format
      let formattedField = null;
      if (timezone) {
        formattedField = fieldToStringField(field, outputFormat, { timeZone: timezone });
      } else {
        formattedField = fieldToStringField(field, outputFormat);
      }

      return formattedField;
    }

    return field;
  });
};
