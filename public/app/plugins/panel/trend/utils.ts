import { DataFrame, FieldType, isLikelyAscendingVector } from '@grafana/data';
import { t } from '@grafana/i18n';
import { findFieldIndex } from 'app/features/dimensions/utils';

export function validateSeries(
  frames: DataFrame[],
  xField?: string
): { warning: string; xFieldIdx?: undefined } | { warning: undefined; xFieldIdx: number } {
  if (frames.length > 1) {
    return {
      warning: t('trend.warning.multiple-frames', 'Only one frame is supported, consider adding a join transformation'),
    };
  }

  let xFieldIdx: number | undefined;
  if (xField) {
    xFieldIdx = findFieldIndex(xField, frames[0]);
    if (xFieldIdx == null) {
      return { warning: t('trend.warning.xField-not-found', 'Unable to find field: {{ xField }}', { xField }) };
    }
  } else {
    // first number field
    // Perhaps we can/should support any ordinal rather than an error here
    xFieldIdx = frames[0] ? frames[0].fields.findIndex((f) => f.type === FieldType.number) : -1;
    if (xFieldIdx === -1) {
      return { warning: t('trend.warning.no-numeric-fields', 'No numeric fields found for X axis') };
    }
  }

  // Make sure values are ascending
  if (xFieldIdx != null) {
    const field = frames[0].fields[xFieldIdx];
    if (field.type === FieldType.number && !isLikelyAscendingVector(field.values)) {
      return {
        warning: t(
          'trend.warning.xField-values-ascending-order',
          `Values in field "{{ xFieldName }}" must be in ascending order`,
          { xFieldName: field.name }
        ),
      };
    }
  }

  return { xFieldIdx, warning: undefined };
}
