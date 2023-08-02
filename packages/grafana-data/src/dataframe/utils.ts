import { DataFrame, FieldType } from '../types/dataFrame';

import { getTimeField } from './processDataFrame';

export function isTimeSeriesFrame(frame: DataFrame) {
  if (frame.fields.length > 2) {
    return false;
  }
  return Boolean(frame.fields.find((field) => field.type === FieldType.time));
}

export function isTimeSeriesFrames(data: DataFrame[]) {
  return !data.find((frame) => !isTimeSeriesFrame(frame));
}

/**
 * Indicates if there is any time field in the array of data frames
 * @param data
 */
export function anySeriesWithTimeField(data: DataFrame[]) {
  for (let i = 0; i < data.length; i++) {
    const timeField = getTimeField(data[i]);
    if (timeField.timeField !== undefined && timeField.timeIndex !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Given data frames representing time series from different time windows, this function shifts the time values
 * of the frames so that they are graphable.
 * This function assumes that the first frame contains the reference time range, while consecutive frames
 * are time shifted.
 */
export function shiftComparisonFramesTimestamps(frames: DataFrame[]) {
  // First frame that holds a time field that's used as comparison diffs reference
  let timeComparisonReferenceFrame: DataFrame | undefined;

  const referenceFrame = frames[0];
  for (let field of referenceFrame.fields) {
    if (field.type === FieldType.time && referenceFrame?.meta?.timeRange) {
      timeComparisonReferenceFrame = referenceFrame;
    }
  }

  frames.forEach((frame) => {
    frame.fields.forEach((f) => {
      if (timeComparisonReferenceFrame && frame !== timeComparisonReferenceFrame) {
        const diff = timeComparisonReferenceFrame.meta?.timeRange?.from.diff(frame.meta?.timeRange?.from!);
        if (f.type === FieldType.time) {
          f.values = f.values.map((v) => {
            return v + (diff || 0);
          });
        }
      }
    });
  });
}
