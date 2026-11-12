import { type AbsoluteTimeRange, type TimeRange, dateTime, rangeUtil } from '@grafana/data';

/** Delivery counts and the Cloud charts start on the last week, like Insights did. */
export function getDefaultHomeRange(): TimeRange {
  return rangeUtil.convertRawToRange({ from: 'now-7d', to: 'now' });
}

/** Turns the shift and zoom helpers' absolute ranges back into a picker value. */
export function toTimeRange({ from, to }: AbsoluteTimeRange): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from: dateTime(from), to: dateTime(to) } };
}

/** Resolves "now" again, so a relative range moves forward on refresh. */
export function resolveRange(range: TimeRange): TimeRange {
  return rangeUtil.convertRawToRange(range.raw);
}

/** The range as the picker shows it, such as "Last 7 days", for hints and subtitles. */
export function describeHomeRange(range: TimeRange): string {
  return rangeUtil.describeTimeRange(range.raw);
}

/** Scenes take the range as strings; absolute ends are passed as epoch milliseconds. */
export function toSceneRange(range: TimeRange): { from: string; to: string } {
  const toText = (value: TimeRange['raw']['from'], resolved: TimeRange['from']) =>
    typeof value === 'string' ? value : String(resolved.valueOf());
  return { from: toText(range.raw.from, range.from), to: toText(range.raw.to, range.to) };
}
