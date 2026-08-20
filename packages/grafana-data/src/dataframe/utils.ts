import { getFieldSeriesColor } from '../field/scale';
import { alpha, darken, lighten } from '../themes/colorManipulator';
import { type GrafanaTheme2 } from '../themes/types';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';
import { type TimeRange } from '../types/time';

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

// Dash-dot-dash pattern for the foreground compare line.
const COMPARE_DASH = [1, 5, 4, 5];

// How much to lighten (light theme) / darken (dark theme) the series color to produce the
// "shadow" backing line, so the compare series reads as a shadow of its current-period counterpart.
const SHADOW_COLOR_AMOUNT = 0.3;

// The shadow is drawn as a faded, translucent line just one step wider than the dashed foreground so
// it reads as a subtle glow/halo hugging the pattern, while still preserving the peaks and valleys
// that the dash pattern would otherwise leave in the gaps.
const SHADOW_LINE_WIDTH_INCREASE = 1;
const SHADOW_OPACITY = 0.35;

/**
 * Aligns time range comparison data by adjusting timestamps and applying compare-specific styling.
 *
 * Each graphable field is expanded into two rendered series: a wide, faded, translucent "shadow"
 * glow (a lightened/darkened shade of the series color) drawn behind, plus a dash-dot-dash line in
 * the series color drawn on top. The glow keeps the shape continuous so peaks/valleys aren't lost in
 * the dash gaps, while the shared color makes the relationship to the current-period series clear.
 *
 * Returns a new DataFrame with new field objects rather than mutating the input - callers (e.g.
 * streaming/split-chunk query paths) may not own the frame or its fields, so mutating them in place
 * can corrupt state shared elsewhere (e.g. a datasource's response accumulator).
 * @param series - The DataFrame containing the comparison data
 * @param diff - The time difference in milliseconds to align the timestamps
 * @param theme - The Grafana theme for color calculations
 */
export function alignTimeRangeCompareData(series: DataFrame, diff: number, theme: GrafanaTheme2): DataFrame {
  const timeCompare = { diffMs: diff, isTimeShiftQuery: true };

  // Non-graphable fields (time/string) keep their position; graphable fields are expanded into a
  // shadow + dashed pair. All shadows are grouped ahead of all foregrounds so that, in multi-series
  // frames, a later series' shadow can't paint over an earlier series' dashed line.
  const passthrough: Field[] = [];
  const shadows: Field[] = [];
  const foregrounds: Field[] = [];

  for (const field of series.fields) {
    // Align compare series time stamps with reference series
    const values =
      field.type === FieldType.time ? field.values.map((v: number) => (diff < 0 ? v - diff : v + diff)) : field.values;

    const isGraphable =
      field.type === FieldType.number || field.type === FieldType.boolean || field.type === FieldType.enum;

    if (!isGraphable) {
      passthrough.push({
        ...field,
        values,
        config: {
          ...(field.config ?? {}),
          custom: { ...(field.config?.custom ?? {}), timeCompare },
        },
      });
      continue;
    }

    const baseColor = getFieldSeriesColor(field, theme).color;
    const shadowTint = theme.isDark ? darken(baseColor, SHADOW_COLOR_AMOUNT) : lighten(baseColor, SHADOW_COLOR_AMOUNT);
    const shadowColor = alpha(shadowTint, SHADOW_OPACITY);
    const baseLineWidth = field.config?.custom?.lineWidth ?? 1;

    // Shadow glow: wide, faded, translucent line drawn behind the dashed line so peaks/valleys survive
    // the dash gaps. Hidden from the legend and tooltip so it doesn't duplicate the compare entry.
    // Each expanded field needs its own `state`: the join step mutates `state.origin` in place, so a
    // shared reference would make the shadow and dashed series resolve to the same origin field.
    shadows.push({
      ...field,
      values,
      state: { ...field.state },
      config: {
        ...(field.config ?? {}),
        custom: {
          ...(field.config?.custom ?? {}),
          timeCompare,
          lineColor: shadowColor,
          lineWidth: baseLineWidth + SHADOW_LINE_WIDTH_INCREASE,
          lineStyle: { fill: 'solid' },
          fillOpacity: 0,
          showPoints: 'never',
          hideFrom: { legend: true, tooltip: true, viz: false },
        },
      },
    });

    // Dash-dot-dash foreground in the series color, drawn on top of the shadow.
    foregrounds.push({
      ...field,
      values,
      state: { ...field.state },
      config: {
        ...(field.config ?? {}),
        custom: {
          ...(field.config?.custom ?? {}),
          timeCompare,
          lineStyle: { fill: 'dash', dash: [...COMPARE_DASH] },
        },
      },
    });
  }

  return { ...series, fields: [...passthrough, ...shadows, ...foregrounds] };
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
