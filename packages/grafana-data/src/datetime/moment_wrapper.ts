import moment from 'moment-timezone';

import { DateTimeInput, dateTime } from './grafana_datetime_wrapper';

/**
 * @deprecated Prefer the Grafana DateTime wrapper. This remains as a compatibility seam
 * for code paths that still require a Moment instance.
 */
export const dateTimeAsMoment = (input?: DateTimeInput) => {
  const value = dateTime(input);
  return moment.tz(value.toISOString(true), String(value.tz?.() ?? 'UTC'));
};
