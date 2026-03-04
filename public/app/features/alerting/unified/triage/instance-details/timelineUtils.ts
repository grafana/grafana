import { Labels } from '@grafana/data';

/**
 * Format a duration given in nanoseconds into a human-readable string.
 * The API returns durations in nanoseconds (see CreateNotificationqueryNotificationEntry.duration).
 */
export function formatDuration(nanoseconds: number): string {
  const ms = Math.floor(nanoseconds / 1_000_000);
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function labelsToMatchers(labels: Labels) {
  return Object.entries(labels).map(([label, value]) => ({
    label,
    type: '=' as const,
    value,
  }));
}

export const noop = () => {};
