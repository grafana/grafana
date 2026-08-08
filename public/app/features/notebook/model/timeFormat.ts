import { rangeUtil, type RawTimeRange } from '@grafana/data';

export function rawToString(value: RawTimeRange['from']): string {
  return typeof value === 'string' ? value : value.toISOString();
}

/** Locked ranges are usually absolute timestamps; show them in a readable local format. */
export function formatLockedRange(from: string, to: string): string {
  const range = rangeUtil.convertRawToRange({ from, to });
  if (rangeUtil.isRelativeTimeRange({ from, to })) {
    return `${from} → ${to}`;
  }
  return `${range.from.format('MMM D, HH:mm')} → ${range.to.format('HH:mm')}`;
}
