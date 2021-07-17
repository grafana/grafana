import { XYFieldMatchers } from './types';
import { ArrayVector, DataFrame, FieldType, outerJoinDataFrames } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';

// will mutate the DataFrame's fields' values
function applySpanNullsThresholds(frame: DataFrame) {
  let refField = frame.fields.find((field) => field.type === FieldType.time); // this doesnt need to be time, just any numeric/asc join field
  let refValues = refField?.values.toArray() as any[];

  for (let i = 0; i < frame.fields.length; i++) {
    let field = frame.fields[i];

    if (field === refField) {
      continue;
    }

    if (field.type === FieldType.number) {
      let spanNulls = field.config.custom?.spanNulls;

      if (typeof spanNulls === 'number') {
        if (spanNulls !== -1) {
          field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
        }
      }
    }
  }

  return frame;
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers) {
  let alignedFrame = outerJoinDataFrames({
    frames: frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });

  return alignedFrame && applySpanNullsThresholds(alignedFrame);
}
