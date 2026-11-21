import { dateTime } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';

/**
 * Resolves a dashboard time zone for the image renderer's `tz` param. `browser` has to be resolved
 * here, as the renderer renders in UTC when `tz` is missing.
 */
export function getRenderTimeZone(timeZone: TimeZone): string {
  const utcOffset = 'UTC' + encodeURIComponent(dateTime().format('Z'));

  if (timeZone === 'utc') {
    return 'UTC';
  }

  if (timeZone === 'browser') {
    if (!window.Intl) {
      return utcOffset;
    }

    const dateFormat = window.Intl.DateTimeFormat();
    const options = dateFormat.resolvedOptions();
    if (!options.timeZone) {
      return utcOffset;
    }

    return options.timeZone;
  }

  return timeZone;
}
