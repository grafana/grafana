import {
  AbsoluteTimeRange,
  DataFrame,
  FieldType,
  LegacyGraphHoverEventPayload,
  reduceField,
  ReducerID,
  dateTimeFormat,
  systemDateFormats,
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

// Check whether event is LegacyGraphHoverEvent
export function isLegacyGraphHoverEvent(event: unknown): event is LegacyGraphHoverEventPayload {
  return Boolean(event && typeof event === 'object' && event.hasOwnProperty('pos'));
}

/** @deprecated */
export const graphTickFormatter = (epoch: number, axis: any) => {
  return dateTimeFormat(epoch, {
    format: axis?.options?.timeformat,
    timeZone: axis?.options?.timezone,
  });
};

/** @deprecated */
export const graphTimeFormat = (ticks: number | null, min: number | null, max: number | null): string => {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    // Need have 10 millisecond margin on the day range
    // As sometimes last 24 hour dashboard evaluates to more than 86400000
    const oneDay = 86400010;
    const oneYear = 31536000000;

    if (secPerTick <= 10) {
      return systemDateFormats.interval.millisecond;
    }
    if (secPerTick <= 45) {
      return systemDateFormats.interval.second;
    }
    if (range <= oneDay) {
      return systemDateFormats.interval.minute;
    }
    if (secPerTick <= 80000) {
      return systemDateFormats.interval.hour;
    }
    if (range <= oneYear) {
      return systemDateFormats.interval.day;
    }
    if (secPerTick <= 31536000) {
      return systemDateFormats.interval.month;
    }
    return systemDateFormats.interval.year;
  }

  return systemDateFormats.interval.minute;
};
