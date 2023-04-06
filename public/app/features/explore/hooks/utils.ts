import { isEmpty, isObject, mapValues, omitBy } from 'lodash';

import {
  TimeRange,
  RawTimeRange,
  TimeFragment,
  DateTime,
  isDateTime,
  toUtc,
  dateMath,
  ExploreUrlState,
} from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { clearQueryKeys } from 'app/core/utils/explore';
import { ExploreItemState } from 'app/types';

import { toRawTimeRange } from '../utils/time';

export function getTimeRangeFromUrl(range: RawTimeRange, timeZone: TimeZone): TimeRange {
  const raw = {
    from: parseRawTime(range.from)!,
    to: parseRawTime(range.to)!,
  };

  return {
    from: dateMath.parse(raw.from, false, timeZone as any)!,
    to: dateMath.parse(raw.to, true, timeZone as any)!,
    raw,
  };
}

function parseRawTime(value: string | DateTime): TimeFragment | null {
  if (value === null) {
    return null;
  }

  if (isDateTime(value)) {
    return value;
  }

  if (value.indexOf('now') !== -1) {
    return value;
  }
  if (value.length === 8) {
    return toUtc(value, 'YYYYMMDD');
  }
  if (value.length === 15) {
    return toUtc(value, 'YYYYMMDDTHHmmss');
  }
  // Backward compatibility
  if (value.length === 19) {
    return toUtc(value, 'YYYY-MM-DD HH:mm:ss');
  }

  // This should handle cases where value is an epoch time as string
  if (value.match(/^\d+$/)) {
    const epoch = parseInt(value, 10);
    return toUtc(epoch);
  }

  // This should handle ISO strings
  const time = toUtc(value);
  if (time.isValid()) {
    return time;
  }

  return null;
}

/**
 * recursively walks an object, removing keys where the value is undefined
 * if the resulting object is empty, returns undefined
 **/
function pruneObject(obj: object): object | undefined {
  let pruned = mapValues(obj, (value) => (isObject(value) ? pruneObject(value) : value));
  pruned = omitBy<typeof pruned>(pruned, isEmpty);
  if (isEmpty(pruned)) {
    return undefined;
  }
  return pruned;
}

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.uid || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toRawTimeRange(pane.range),
    // don't include panelsState in the url unless a piece of state is actually set
    panelsState: pruneObject(pane.panelsState),
  };
}
