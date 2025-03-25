import { dateMath, dateTime, isDateTime, DateTime, TimeRange } from '@grafana/data';
import { TimeModel } from 'app/features/dashboard/state/TimeModel';

export const getTimeRange = (
  time: { from: DateTime | string; to: DateTime | string },
  timeModel?: TimeModel
): TimeRange => {
  // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
  const raw = {
    from: isDateTime(time.from) ? dateTime(time.from) : time.from,
    to: isDateTime(time.to) ? dateTime(time.to) : time.to,
  };

  const timezone = timeModel ? timeModel.getTimezone() : undefined;

  return {
    from: dateMath.parse(raw.from, false, timezone, timeModel?.fiscalYearStartMonth)!,
    to: dateMath.parse(raw.to, true, timezone, timeModel?.fiscalYearStartMonth)!,
    raw: raw,
  };
};
