import { TimeRange, TimeZone, RawTimeRange, toUtc, dateTime } from '@grafana/ui';

export const getShiftedTimeRange = (direction: number, origRange: TimeRange, timeZone: TimeZone): RawTimeRange => {
  const range = {
    from: toUtc(origRange.from),
    to: toUtc(origRange.to),
  };

  const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
  let to: number, from: number;

  if (direction === -1) {
    to = range.to.valueOf() - timespan;
    from = range.from.valueOf() - timespan;
  } else if (direction === 1) {
    to = range.to.valueOf() + timespan;
    from = range.from.valueOf() + timespan;
    if (to > Date.now() && range.to.valueOf() < Date.now()) {
      to = Date.now();
      from = range.from.valueOf();
    }
  } else {
    to = range.to.valueOf();
    from = range.from.valueOf();
  }

  const nextTimeRange = {
    from: timeZone === 'utc' ? toUtc(from) : dateTime(from),
    to: timeZone === 'utc' ? toUtc(to) : dateTime(to),
  };

  return nextTimeRange;
};
