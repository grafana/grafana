import { useCallback } from 'react';

import { dateTime, dateTimeFormat, DateTimeInput, getTimeZone, isDateTime } from '@grafana/data';

export function useDateTimeFormat(showSeconds = false) {
  return showSeconds ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm';
}

// This hook returns a function that formats a date to a string, with the user (not client/browser) timezone in mind.
export function useGetFormattedDate(showSeconds = false) {
  const format = useDateTimeFormat(showSeconds);
  const timeZone = getTimeZone();

  // Note: this will always return a valid date string, even if the input is invalid (fallback is `now()`).
  return useCallback(
    (date?: DateTimeInput) => {
      const parsedDate = isDateTime(date) && date.isValid() ? date : dateTime(date, format);
      const validDate = parsedDate.isValid() ? parsedDate : dateTime();

      return dateTimeFormat(validDate, {
        format,
        timeZone,
      });
    },
    [format, timeZone]
  );
}
