import { dateTime, rangeUtil, TimeRange } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

const RANGE_RE = /^(\d+) (\d+)$/; // find digits, then a space, then digits again.

// there is no exported "getTimeSrv" functionality,
// so we use the template server to access the current time range.
export function getCurrentTimeRange(templateSrv: TemplateSrv): TimeRange {
  const text = templateSrv.replace('$__from $__to');

  // this is a "string based API", so we try to be sure
  // that the returned data is correct.
  const match = text.match(RANGE_RE);
  if (match == null) {
    throw new Error('time range info unavailable');
  }

  const fromText = match[1];
  const toText = match[2];
  const from = dateTime(Number(fromText));
  const to = dateTime(Number(toText));

  return rangeUtil.convertRawToRange({ from, to });
}
