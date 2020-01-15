import { dateTime } from '@grafana/data';

// This function will try to return the proper full name of the local timezone
// Chrome does not handle the timezone offset (but phantomjs does)
export function getLocalTimeZone(): string {
  const utcOffset = 'UTC' + dateTime().format('Z');

  // Older browser does not the internationalization API
  if (!(window as any).Intl) {
    return utcOffset;
  }

  const dateFormat = (window as any).Intl.DateTimeFormat();
  if (!dateFormat.resolvedOptions) {
    return utcOffset;
  }

  const options = dateFormat.resolvedOptions();
  if (!options.timeZone) {
    return utcOffset;
  }

  return options.timeZone;
}
