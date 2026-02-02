// eslint-disable-next-line no-restricted-imports
import moment from 'moment';

import { TimeRange, TimeZone, dateTime, rangeUtil, dateTimeFormat } from '@grafana/data';

import { dateRangeExtract } from '../utils';
// eslint-disable-next-line no-restricted-imports

export const getDefaultTimeRange = (): TimeRange => {
  const to = dateTime();
  const from = dateTime();

  return {
    from,
    to,
    raw: {
      from,
      to,
    },
  };
};

export const convertQuery2TimeRange = (query: string | string[], tz?: TimeZone) => {
  const targetQuery = query instanceof Array ? query[0] : query;
  if (targetQuery) {
    const dateStrArr = dateRangeExtract(targetQuery);
    if ((!dateStrArr?.[0] && !dateStrArr?.[1]) || (dateStrArr?.[0] === 'null' && dateStrArr?.[1] === 'null')) {
      return {
        from: dateTime(null),
        to: dateTime(null),
        raw: {
          from: dateTime(null),
          to: dateTime(null),
        },
      } as TimeRange;
    }
    const fromDate = moment(dateStrArr[0]);
    const toDate = moment(dateStrArr[1]);
    const timeRange = {
      from: dateStrArr[0],
      to: dateStrArr[1],
    };
    const isRT = rangeUtil.isRelativeTimeRange(timeRange);
    if (isRT) {
      const convertedTimeRange = rangeUtil.convertRawToRange({
        from: rangeUtil.isRelativeTime(dateStrArr[0]) ? dateStrArr[0] : dateTimeFormat(dateStrArr[0]),
        to: rangeUtil.isRelativeTime(dateStrArr[1]) ? dateStrArr[1] : dateTimeFormat(dateStrArr[1]),
      });
      return convertedTimeRange;
    }

    if (fromDate.isValid() && toDate.isValid()) {
      return {
        from: fromDate,
        to: toDate,
        raw: {
          from: fromDate,
          to: toDate,
        },
      } as TimeRange;
    }
  }
  return getDefaultTimeRange();
};

export const convertTimeRange2Query = (timeRange?: TimeRange): string => {
  if (timeRange) {
    try {
      const query = getPreviewForDate(timeRange);
      return query;
    } catch (e) {}
  }
  return getPreviewForDate(getDefaultTimeRange());
};

export const getPreviewForDate = (timeRange: TimeRange) => {
  //if now is present in the raw field of timerange object
  // preview date saved is in GMT format.
  return (
    'From: ' +
    (rangeUtil.isRelativeTime(timeRange.raw.from) ? timeRange.raw.from : JSON.parse(JSON.stringify(timeRange.from))) +
    ' - To: ' +
    (rangeUtil.isRelativeTime(timeRange.raw.to) ? timeRange.raw.to : JSON.parse(JSON.stringify(timeRange.to)))
  );
};
