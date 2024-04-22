import { useCallback } from 'react';

import { dateTime, dateTimeFormat, DateTimeInput, getTimeZone, isDateTime } from '@grafana/data';

// This hook returns a function that formats a date to a string, with the user (not client/browser) timezone in mind.
export function useGetFormattedDate(showSeconds = false) {
  const format = showSeconds ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm';
  const timeZone = getTimeZone();

  // Note: this will always return a valid date string, even if the input is invalid (fallback is `now()`).
  return useCallback(
    (date?: DateTimeInput) => {
      const parsedDate = isDateTime(date) && date.isValid() ? date : dateTime(date);
      const validDate = parsedDate.isValid() ? parsedDate : dateTime();

      return dateTimeFormat(validDate, {
        format,
        timeZone,
      });
    },
    [format, timeZone]
  );
}
