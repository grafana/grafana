import { type DataFrame, FieldType } from '@grafana/data';

/**
 * Returns the first frame whose time field contains a null value, or undefined
 * when every frame's time field is fully populated. The Data Plane timeseries
 * spec requires non-null timestamps; a null time cell would otherwise reach
 * consumers like zoom-to-data, which propagate it into range parsing and crash.
 *
 * Run this against the OUTPUT of frame-preparation helpers so frames that are
 * about to be rendered are the ones being vetted.
 */
export function findFrameWithNullTimeValue(frames: DataFrame[]): DataFrame | undefined {
  return frames.find((frame) => {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    return timeField != null && timeField.values.some((v) => v == null);
  });
}
