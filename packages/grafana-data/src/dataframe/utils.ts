import { DataFrame, Field, FieldType } from '../types/dataFrame';
import { TimeRange } from '../types/time';

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

/**
 * Simple helper to add values to a data frame. Doesn't do any validation so make sure you are adding the right types
 * of values.
 * @param dataFrame
 * @param row Either an array of values or an object with keys that match the field names.
 */
export function addRow(dataFrame: DataFrame, row: Record<string, unknown> | unknown[]) {
  if (row instanceof Array) {
    for (let i = 0; i < row.length; i++) {
      dataFrame.fields[i].values.push(row[i]);
    }
  } else {
    for (const field of dataFrame.fields) {
      field.values.push(row[field.name]);
    }
  }
  try {
    dataFrame.length++;
  } catch (e) {
    // Unfortunate but even though DataFrame as interface defines length some implementation of DataFrame only have
    // length getter. In that case it will throw and so we just skip and assume they defined a `getter` for length that
    // does not need any external updating.
  }
}

/**
 * Aligns time range comparison data by adjusting timestamps and applying compare-specific styling
 * @param series - The DataFrame containing the comparison data
 * @param diff - The time difference in milliseconds to align the timestamps
 * @param compareColor - Optional color to use for the comparison series (defaults to 'gray')
 */
export function alignTimeRangeCompareData(series: DataFrame, diff: number, compareColor = 'gray') {
  series.fields.forEach((field: Field) => {
    // Align compare series time stamps with reference series
    if (field.type === FieldType.time) {
      field.values = field.values.map((v: number) => {
        return diff < 0 ? v - diff : v + diff;
      });
    }

    field.config = {
      ...(field.config ?? {}),
      color: {
        mode: 'fixed',
        fixedColor: compareColor,
      },
      custom: {
        ...(field.config?.custom ?? {}),
        timeCompare: {
          diffMs: diff,
          isTimeShiftQuery: true,
        },
      },
    };
  });
}

/**
 * Checks if a time comparison frame needs alignment based on whether its first time is before the current time range.
 * Returns true if the first time in compare is before timeRange.from, indicating it needs shifting.
 * @param compareFrame - The frame with time comparison data
 * @param allFrames - Array of all frames to find the matching original frame
 * @param timeRange - The current panel time range
 * @returns true if alignment is needed
 */
export function shouldAlignTimeCompare(compareFrame: DataFrame, allFrames: DataFrame[], timeRange: TimeRange): boolean {
  // Find the matching original frame by removing '-compare' from refId
  const compareRefId = compareFrame.refId;
  if (!compareRefId || !compareRefId.endsWith('-compare')) {
    return false;
  }

  const originalRefId = compareRefId.replace('-compare', '');
  const originalFrame = allFrames.find(
    (frame) => frame.refId === originalRefId && !frame.meta?.timeCompare?.isTimeShiftQuery
  );

  if (!originalFrame) {
    return false;
  }

  // Find time fields
  const compareTimeField = compareFrame.fields.find((field) => field.type === FieldType.time);
  const originalTimeField = originalFrame.fields.find((field) => field.type === FieldType.time);

  if (!compareTimeField?.values.length || !originalTimeField?.values.length) {
    return false;
  }

  // Find first non-null time value from each frame
  const compareFirstTime = compareTimeField.values.find((value) => value != null);
  const originalFirstTime = originalTimeField.values.find((value) => value != null);

  if (compareFirstTime == null || originalFirstTime == null) {
    return false;
  }

  // Check if first non-null time value is before timeRange.from
  return compareFirstTime < timeRange.from.valueOf();
}
