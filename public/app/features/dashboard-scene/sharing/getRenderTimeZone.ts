import { dateTime } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';

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
