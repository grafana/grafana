import { DataFrame, FieldType, isLikelyAscendingVector } from '@grafana/data';
import config from 'app/core/config';
import { findFieldIndex } from 'app/features/dimensions/utils';

import { prepareGraphableFields } from '../timeseries/utils';

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
    // first number field
    // Perhaps we can/should support any ordinal rather than an error here
    xFieldIdx = frames[0] ? frames[0].fields.findIndex((f) => f.type === FieldType.number) : -1;
    if (xFieldIdx === -1) {
      return {
        warning: 'No numeric fields found for X axis',
        frames,
      };
    }
  }

  // Make sure values are ascending
  if (xFieldIdx != null) {
    const field = frames[0].fields[xFieldIdx];
    if (field.type === FieldType.number && !isLikelyAscendingVector(field.values)) {
      return {
        warning: `Values must be in ascending order`,
        frames,
      };
    }
  }

  return { frames: prepareGraphableFields(frames, config.theme2, undefined, xFieldIdx) };
}
