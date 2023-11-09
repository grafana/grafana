import { DataFrame, Field, FieldType } from '../types/dataFrame';

import { getTimeField } from './processDataFrame';

const MAX_TIME_COMPARISONS = 100;

export function isTimeSeriesFrame(frame: DataFrame, timeField?: Field | undefined) {
  // If we have less than two frames we can't have a timeseries
  if (frame.fields.length < 2) {
    return false;
  }

  // In order to have a time series we need a time field
  // Optionally, we see if there's a field that's been configured for time
  // and we use that
  if (timeField === undefined) {
    timeField = frame.fields.find((field) => field.type === FieldType.time);
  }

  // Find a number field, as long as we have any number field this should work
  const numberField = frame.fields.find((field) => field.type === FieldType.number);

  // There are certain query types in which we will
  // get times but they will be the same or not be
  // in increasing order. To have a time-series the
  // times need to be ordered from past to present
  if (timeField !== undefined) {
    let greatestTime: number | null = null;
    let testWindow = timeField.values.length > MAX_TIME_COMPARISONS ? MAX_TIME_COMPARISONS : timeField.values.length;

    for (let i = 0; i < testWindow; i++) {
      const time = timeField.values[i];

      // Check to see if the current time is greater than
      // the great time. If we get to the end then we
      // have a time series otherwise we return false
      if (greatestTime === null || (time !== null && time > greatestTime)) {
        greatestTime = time;
      } else {
        return false;
      }
    }
  }

  return timeField !== undefined && numberField !== undefined;
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
