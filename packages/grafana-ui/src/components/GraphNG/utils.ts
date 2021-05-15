import { XYFieldMatchers } from './types';
import { ArrayVector, DataFrame, FieldType, outerJoinDataFrames } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';

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
        field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
      }
    }
  }
}

// sets to undefined all same future values not preceeded by explicit null
// in:  1,        1,undefined,        1,2,        2,null,2,3
// out: 1,undefined,undefined,undefined,2,undefined,null,2,3
function unsetSameFutureValues(frame: DataFrame) {
  for (const field of frame.fields) {
    if (field.type !== FieldType.time) {
      let mergeValues = field.config.custom?.mergeValues;

      if (mergeValues) {
        let values = field.values.toArray();
        let prevVal = values[0];

        for (let i = 1; i < values.length; i++) {
          let value = values[i];

          if (value === null) {
            prevVal = null;
          } else {
            if (value === prevVal) {
              values[i] = undefined;
            } else if (value != null) {
              prevVal = value;
            }
          }
        }

        field.values = new ArrayVector(values);
      }
    }
  }
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers) {
  const joinedFrame = outerJoinDataFrames({
    frames: frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });

  // mutates field data!
  if (joinedFrame) {
    applySpanNullsThresholds(joinedFrame);
    unsetSameFutureValues(joinedFrame);
  }

  return joinedFrame;
}
