import { getFieldSeriesColor } from '../field/fieldColor';
import { GrafanaTheme2 } from '../themes/types';
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
 * @param theme - The Grafana theme for color calculations
 */
export function alignTimeRangeCompareData(series: DataFrame, diff: number, theme: GrafanaTheme2) {
  series.fields.forEach((field: Field) => {
    // Align compare series time stamps with reference series
    if (field.type === FieldType.time) {
      field.values = field.values.map((v: number) => {
        return diff < 0 ? v - diff : v + diff;
      });
    }

    field.config = {
      ...(field.config ?? {}),
      custom: {
        ...(field.config?.custom ?? {}),
        timeCompare: {
          diffMs: diff,
          isTimeShiftQuery: true,
        },
      },
    };

    // Apply visual styling for comparison series
    if (field.type === FieldType.number || field.type === FieldType.boolean || field.type === FieldType.enum) {
      const seriesColor = getFieldSeriesColor(field, theme).color;
      const lineStyle = field.config.custom?.lineStyle;
      const isSolid = !lineStyle?.fill || lineStyle.fill === 'solid';

      if (isSolid) {
        field.config.custom = {
          ...(field.config.custom ?? {}),
          lineStyle: {
            fill: 'dash',
            dash: [10, 10],
          },
        };
      } else {
        // For already dashed/dotted lines, reduce opacity
        const tinycolor = require('tinycolor2');
        field.config.color = {
          mode: 'fixed',
          fixedColor: tinycolor(seriesColor).setAlpha(0.5).toString(),
        };
      }
    }
  });
}
