import { getZone } from '@grafana/data';

/**
 * React calendar doesn't support showing ranges in other time zones, so attempting to show
 * 10th midnight - 11th midnight in another time zone than your browsers will span three days
 * instead of two.
 *
 * This function adjusts the dates by "moving" the time to appear as if it's local.
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
  // we keep these as separate variables in case one of them crosses a daylight savings boundary
  const diff = timezonePrefOffset - localOffset;

  const newDate = new Date(date.getTime() - diff * 1000 * 60);
  return newDate;
}
