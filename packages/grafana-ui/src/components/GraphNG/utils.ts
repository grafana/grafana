import { XYFieldMatchers } from './types';
import {
  ArrayVector,
  DataFrame,
  EventBus,
  FieldType,
  GrafanaTheme2,
  outerJoinDataFrames,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';

export type PrepConfigOpts<T extends Record<string, any> = {}> = {
  frame: DataFrame;
  theme: GrafanaTheme2;
  timeZone: TimeZone;
  getTimeRange: () => TimeRange;
  eventBus: EventBus;
} & T;

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

// sets to undefined all same future values not preceeded by explicit null
// in:  1,        1,undefined,        1,2,        2,null,2,3
// out: 1,undefined,undefined,undefined,2,undefined,null,2,3
function unsetSameFutureValues(frames: DataFrame[]) {
  for (const frame of frames) {
    for (const field of frame?.fields!) {
      if (field.type !== FieldType.time) {
        let mergeValues = field.config.custom?.mergeValues;

        if (mergeValues) {
          let values = field.values.toArray();
          let prevVal = values[0];

          for (let i = 1; i < values.length; i++) {
            let value = values[i];

            if (value == null) {
              prevVal = null;
            } else {
              if (prevVal != null && value === prevVal) {
                values[i] = undefined;
              }
              prevVal = value;
            }
          }
          field.values = new ArrayVector(values);
        }
      }
    }
  }
}

export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers) {
  applySpanNullsThresholds(frames);
  unsetSameFutureValues(frames);

  return outerJoinDataFrames({
    frames: frames,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });
}
