import { type DataFrame, type Field, FieldType, isLikelyAscendingVector } from '@grafana/data';
import { ScaleDistribution } from '@grafana/schema';
import config from 'app/core/config';
import { findFieldIndex } from 'app/features/dimensions/utils';

import { prepareGraphableFields } from '../timeseries/utils';

/**
 * Auto-detect which field to use as X axis.
 * - If a time field exists, use the first number field (standard Trend behavior).
 * - If no time field: prefer a string field as X (categorical), keeping numbers for Y.
 * - Fallback: first number field.
 */
export function findXFieldIndex(fields: Field[]): number {
  const hasTimeField = fields.some((f) => f.type === FieldType.time);

  // When time is present, always use first number as X (original Trend behavior)
  if (hasTimeField) {
    return fields.findIndex((f) => f.type === FieldType.number);
  }

  // No time field: prefer string as X so number fields remain for Y
  const stringIdx = fields.findIndex((f) => f.type === FieldType.string);
  if (stringIdx !== -1) {
    return stringIdx;
  }

  // Fallback: first number field (needs 2+ for X + Y)
  return fields.findIndex((f) => f.type === FieldType.number);
}

export function prepSeries(frames: DataFrame[], xField?: string): { warning?: string; frames: DataFrame[] | null } {
  if (frames.length > 1) {
    return {
      warning: 'Only one frame is supported, consider adding a join transformation',
      frames: frames,
    };
  }

  let xFieldIdx: number | undefined;
  if (xField) {
    xFieldIdx = findFieldIndex(xField, frames[0]);
    if (xFieldIdx == null) {
      return {
        warning: 'Unable to find field: ' + xField,
        frames: frames,
      };
    }
  } else {
    xFieldIdx = frames[0] ? findXFieldIndex(frames[0].fields) : -1;

    if (xFieldIdx === -1) {
      return {
        warning: 'No numeric or string fields found for X axis',
        frames,
      };
    }
  }

  // Make sure values are ascending (only for numeric fields)
  if (xFieldIdx != null) {
    const field = frames[0].fields[xFieldIdx];
    if (field.type === FieldType.number && !isLikelyAscendingVector(field.values)) {
      return {
        warning: `Values must be in ascending order`,
        frames,
      };
    }

    // For string X fields, create a synthetic numeric field with index values
    if (field.type === FieldType.string) {
      const labels = field.values.slice();
      const indexValues = labels.map((_, i) => i);

      const syntheticField: Field = {
        name: field.name,
        type: FieldType.number,
        config: {
          ...field.config,
          min: -0.5,
          max: labels.length - 0.5,
          custom: {
            ...field.config.custom,
            scaleDistribution: { type: ScaleDistribution.Ordinal },
          },
        },
        values: indexValues,
        display: (value: unknown) => {
          if (value == null || (typeof value === 'number' && isNaN(value))) {
            return { text: '', numeric: 0 };
          }
          const num = typeof value === 'number' ? value : Number(value);
          const idx = Math.max(0, Math.min(labels.length - 1, Math.round(num)));
          return {
            text: labels[idx] ?? String(value),
            numeric: idx,
          };
        },
      };

      const newFields = [...frames[0].fields];
      newFields[xFieldIdx] = syntheticField;
      frames = [{ ...frames[0], fields: newFields }];
    }
  }

  return { frames: prepareGraphableFields(frames, config.theme2, undefined, xFieldIdx) };
}
