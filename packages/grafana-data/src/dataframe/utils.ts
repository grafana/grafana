import { DataFrame, Field, FieldType } from '../types/dataFrame';

import { getTimeField } from './processDataFrame';

const MAX_TIME_COMPARISONS = 100;

export function isTimeSeriesFrame(frame: DataFrame) {
  // If we have less than two frames we can't have a timeseries
  if (frame.fields.length < 2) {
    return false;
  }

  // Find a number field, as long as we have any number field this should work
  const numberField = frame.fields.find((field) => field.type === FieldType.number);

  // There are certain query types in which we will
  // get times but they will be the same or not be
  // in increasing order. To have a time-series the
  // times need to be ordered from past to present
  let timeFieldFound = false;
  for (const field of frame.fields) {
    if (isTimeSeriesField(field)) {
      timeFieldFound = true;
      break;
    }
  }

  return timeFieldFound && numberField !== undefined;
}

export function isTimeSeriesFrames(data: DataFrame[]) {
  return !data.find((frame) => !isTimeSeriesFrame(frame));
}

/**
 * Determines if a field is a time field in ascending
 * order within the sampling range specified by
 * MAX_TIME_COMPARISONS
 *
 * @param field
 * @returns boolean
 */
export function isTimeSeriesField(field: Field) {
  if (field.type !== FieldType.time) {
    return false;
  }

  let greatestTime: number | null = null;
  let testWindow = field.values.length > MAX_TIME_COMPARISONS ? MAX_TIME_COMPARISONS : field.values.length;

  // Test up to the test window number of values
  for (let i = 0; i < testWindow; i++) {
    const time = field.values[i];

    // Check to see if the current time is greater than
    // the last time. If we get to the end then we
    // have a time series otherwise we return false
    if (greatestTime === null || (time !== null && time > greatestTime)) {
      greatestTime = time;
    } else {
      return false;
    }
  }

  return true;
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
 * Indicates if there is any time field in the data frame
 * @param data
 */
export function hasTimeField(data: DataFrame): boolean {
  return data.fields.some((field) => field.type === FieldType.time);
}

/**
 * Get row id based on the meta.uniqueRowIdFields attribute.
 * @param dataFrame
 * @param rowIndex
 */
export function getRowUniqueId(dataFrame: DataFrame, rowIndex: number) {
  if (dataFrame.meta?.uniqueRowIdFields === undefined) {
    return undefined;
  }
  return dataFrame.meta.uniqueRowIdFields.map((fieldIndex) => dataFrame.fields[fieldIndex].values[rowIndex]).join('-');
}
