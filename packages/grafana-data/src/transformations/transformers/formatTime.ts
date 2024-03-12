import { map } from 'rxjs/operators';

import { TimeZone } from '@grafana/schema';

import { cacheFieldDisplayNames } from '../../field';
import { DataFrame, TransformationApplicabilityLevels } from '../../types';
import { DataTransformContext, DataTransformerInfo } from '../../types/transformations';

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
  isApplicable: (data: DataFrame[]) => {
    // Search for a time field
    // if there is one then we can use this transformation
    for (const frame of data) {
      for (const field of frame.fields) {
        if (field.type === 'time') {
          return TransformationApplicabilityLevels.Applicable;
        }
      }
    }

    return TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription:
    'The Format time transformation requires a time field to work. No time field could be found.',
  operator: (options, ctx) => (source) =>
    source.pipe(
      map((data) => {
        return applyFormatTime(options, data, ctx);
      })
    ),
};

/**
 * @internal
 */
export const applyFormatTime = (
  { timeField, outputFormat, timezone }: FormatTimeTransformerOptions,
  data: DataFrame[],
  ctx?: DataTransformContext
) => {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  cacheFieldDisplayNames(data);

  outputFormat = ctx?.interpolate(outputFormat) ?? outputFormat;

  return data.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) => {
      if (field.state?.displayName === timeField) {
        field = fieldToStringField(field, outputFormat, { timeZone: timezone });
      }

      return field;
    }),
  }));
};
