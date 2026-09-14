import { type GrafanaTheme2 } from '../themes/types';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';
import { type TimeRange } from '../types/time';

/** Whether a frame holds time-comparison (previous period) data rather than the current period. */
export function isTimeCompareFrame(frame?: DataFrame): boolean {
  return Boolean(frame?.meta?.timeCompare?.isTimeShiftQuery);
}

/**
 * Suffix appended to a compare series' display name so it is distinguishable from its
 * current-period counterpart in legends and tooltips.
 */
export function withComparisonSuffix(displayName: string): string {
  return `${displayName} (comparison)`;
}

type ShiftedTimeValues = {
  offset: number;
  // Length plus both endpoints detect in-place mutation of the same array object: query paths that
  // accumulate append to it, and live/streaming ring buffers slide values without changing the length.
  // Checking only the last value would miss a slide whose new point repeats the previous last
  // timestamp. A slide that also keeps the first timestamp (duplicate at the start, then another
  // copy of the last appended) would reuse a stale array; that dual-end case is left as a known gap.
  sourceLength: number;
  sourceFirst: number;
  sourceLast: number;
  shifted: number[];
};

// Keyed on the source values array, not the frame: panel preparation rebuilds frame and field
// objects on every render while passing the time field's values array through by reference
// (unless gap filling has to rebuild it).
const shiftedTimeValuesCache = new WeakMap<object, ShiftedTimeValues>();

function shiftTimeValues(values: number[], offset: number): number[] {
  if (values.length === 0) {
    return values;
  }

  const cached = shiftedTimeValuesCache.get(values);

  if (
    cached !== undefined &&
    cached.offset === offset &&
    cached.sourceLength === values.length &&
    cached.sourceFirst === values[0] &&
    cached.sourceLast === values[values.length - 1]
  ) {
    return cached.shifted;
  }

  const shifted = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    shifted[i] = values[i] + offset;
  }

  shiftedTimeValuesCache.set(values, {
    offset,
    sourceLength: values.length,
    sourceFirst: values[0],
    sourceLast: values[values.length - 1],
    shifted,
  });

  return shifted;
}

/**
 * Aligns time range comparison data by adjusting timestamps and applying compare-specific styling.
 * Returns a new DataFrame with new field objects rather than mutating the input - callers (e.g.
 * streaming/split-chunk query paths) may not own the frame or its fields, so mutating them in place
 * can corrupt state shared elsewhere (e.g. a datasource's response accumulator).
 *
 * Shifted time values are cached per source values array, so repeated calls for unchanged data reuse
 * the same shifted array instead of reallocating it. Consumers must treat the returned values arrays
 * as read-only, as two calls for the same input can hand back the same array.
 * @param series - The DataFrame containing the comparison data
 * @param diff - The time difference in milliseconds to align the timestamps
 * @param theme - The Grafana theme for color calculations
 */
export function alignTimeRangeCompareData(series: DataFrame, diff: number, theme: GrafanaTheme2): DataFrame {
  // Compare series always shift forward onto the current range, whichever direction diff is expressed in.
  const offset = diff < 0 ? -diff : diff;

  const fields = series.fields.map((field: Field): Field => {
    // Align compare series time stamps with reference series
    const values = field.type === FieldType.time ? shiftTimeValues(field.values, offset) : field.values;

    const config = {
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
      config.custom = {
        ...config.custom,
        lineStyle: {
          fill: 'dash',
          dash: [1, 5, 4, 5],
        },
      };
    }

    return { ...field, values, config };
  });

  return { ...series, fields };
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
  const originalFrame = allFrames.find((frame) => frame.refId === originalRefId && !isTimeCompareFrame(frame));

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
