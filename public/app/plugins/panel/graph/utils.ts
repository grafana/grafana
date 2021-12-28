import {
  AbsoluteTimeRange,
  DataFrame,
  FieldType,
  LegacyGraphHoverEventPayload,
  reduceField,
  ReducerID,
} from '@grafana/data';

/**
 * Find the min and max time that covers all data
 */
export function getDataTimeRange(frames: DataFrame[]): AbsoluteTimeRange | undefined {
  const range: AbsoluteTimeRange = {
    from: Number.MAX_SAFE_INTEGER,
    to: Number.MIN_SAFE_INTEGER,
  };
  let found = false;
  const reducers = [ReducerID.min, ReducerID.max];
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.time) {
        const calcs = reduceField({ field, reducers });
        range.from = Math.min(range.from, calcs[ReducerID.min]);
        range.to = Math.max(range.to, calcs[ReducerID.max]);
        found = true;
      }
    }
  }
  return found ? range : undefined;
}

// Check wether event is LegacyGraphHoverEvent
export function isLegacyGraphHoverEvent(event: any): event is LegacyGraphHoverEventPayload {
  return event.hasOwnProperty('pos');
}
