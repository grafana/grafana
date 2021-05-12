import { XYFieldMatchers } from './types';
import { ArrayVector, DataFrame, FieldType, outerJoinDataFrames } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';

function applySpanNullsThresholds(frames: DataFrame[]) {
  for (const frame of frames) {
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
          field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
        }
      }
    }
  }

  return frames;
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers) {
  applySpanNullsThresholds(frames);

  return outerJoinDataFrames({
    frames: frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });
}
