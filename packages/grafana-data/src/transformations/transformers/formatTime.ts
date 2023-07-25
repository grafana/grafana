import { map } from 'rxjs/operators';

import { dateTime } from '../../datetime';
import { DataFrame, Field, FieldType } from '../../types';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface FormatTimeTransformerOptions {
  timeField: string;
  outputFormat: string;
}

export const formatTimeTransformer: DataTransformerInfo<FormatTimeTransformerOptions> = {
  id: DataTransformerID.formatTime,
  name: 'Format Time',
  description: 'Set the output format of a time field',
  defaultOptions: { timeField: '', outputFormat: '' },
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        // If a field and a format are configured
        // then format the time output
        const formatter = createTimeFormatter(options.timeField, options.outputFormat);

        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: formatter(frame.fields, data, frame),
        }));
      })
    ),
};

const createTimeFormatter =
  (timeField: string, outputFormat: string) => (fields: Field[], data: DataFrame[], frame: DataFrame) => {
    return fields.map((field) => {
      // Find the configured field
      if (field.name === timeField) {
        // Update values to use the configured format
        const newVals = field.values.map((value) => {
          const moment = dateTime(value);
          return moment.format(outputFormat);
        });

        return {
          ...field,
          type: FieldType.string,
          values: newVals,
        };
      }

      return field;
    });
  };
