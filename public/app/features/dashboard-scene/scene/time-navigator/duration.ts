/**
 * Duration helpers that depend on `@grafana/data` parsing (kept separate from the pure `timeModel` so
 * that module stays dependency-free and trivially testable).
 */
import { parseDuration, durationToMilliseconds } from '@grafana/data';

import { type TimeRangeMs } from './timeModel';

/**
 * Parse a Grafana duration string (e.g. "12h", "2d", "1h 30m") to milliseconds, or null if invalid.
 * Zero (e.g. "0h") is a valid duration and returns 0 — used by the "Same as timepicker" preset.
 * Note: compound durations must be space-separated ("1h 30m", not "1h30m"), matching `@grafana/data`.
 * A leading "-" is rejected (upstream `parseDuration` silently drops the sign, which we don't want).
 */
export function durationToMs(duration: string): number | null {
  if (typeof duration !== 'string' || duration.trim().startsWith('-')) {
    return null;
  }
  try {
    const parsed = parseDuration(duration);
    // parseDuration returns an empty object for unparseable input ('abc', '', space-less '1h30m'),
    // which is indistinguishable from a real zero by ms alone — so reject empties explicitly.
    if (Object.keys(parsed).length === 0) {
      return null;
    }
    const ms = durationToMilliseconds(parsed);
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  } catch {
    return null;
  }
}

/**
 * The absolute selection implied by a relative duration ending at `dashboardTo`
 * (e.g. duration "6h" -> [dashboardTo - 6h, dashboardTo]). Null if the duration is invalid or zero.
 */
export function selectionFromRelativeDuration(dashboardTo: number, duration: string): TimeRangeMs | null {
  const ms = durationToMs(duration);
  if (ms == null || ms <= 0) {
    return null;
  }
  return { from: dashboardTo - ms, to: dashboardTo };
}
