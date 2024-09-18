import { getZone } from '@grafana/data';

/**
 * React calendar doesn't support showing dates in other time zones, so attempting to show
 * values near midnight in another time zone than your browsers may end up showing the wrong date
 *
 * This function adjusts a date by "moving" the time to appear as if it's local.
 * e.g. make 5 PM New York "look like" 5 PM in the user's local browser time.
 * See also https://github.com/wojtekmaj/react-calendar/issues/511#issuecomment-835333976
 */
export function adjustDateForReactCalendar(date: Date, timeZone: string): Date {
  const zone = getZone(timeZone);
  if (!zone) {
    return date;
  }

  // get utc offset for timezone preference
  const timezonePrefOffset = zone.utcOffset(date.getTime());

  // get utc offset for local timezone
  const localOffset = date.getTimezoneOffset();

  // calculate difference between timezone preference and local timezone
  const diff = timezonePrefOffset - localOffset;

  const newDate = new Date(date.getTime() - diff * 1000 * 60);
  return newDate;
}
