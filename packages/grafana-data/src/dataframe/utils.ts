import { DataFrame, FieldType } from '../types/dataFrame';

import { getTimeField } from './processDataFrame';

export function isTimeSeriesFrame(frame: DataFrame) {
  // If we have less than two frames we can't have a timeseries
  if (frame.fields.length < 2) {
    return false;
  }

  // In order to have a time series we need a time field
  // and at least one number field
  const timeField = frame.fields.find((field) => field.type === FieldType.time);
  const numberField = frame.fields.find((field) => field.type === FieldType.number);
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
