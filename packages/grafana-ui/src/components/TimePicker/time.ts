import moment, { Moment } from 'moment';
import { TimeOption, TimeRange, TIME_FORMAT } from '../../types/time';
import { describeTimeRange } from '../../utils/rangeutil';
import * as dateMath from '../../utils/datemath';

export const mapTimeOptionToTimeRange = (
  timeOption: TimeOption,
  isTimezoneUtc: boolean,
  timezone?: dateMath.Timezone
): TimeRange => {
  const fromMoment = stringToMoment(timeOption.from, isTimezoneUtc, false, timezone);
  const toMoment = stringToMoment(timeOption.to, isTimezoneUtc, true, timezone);

  return { from: fromMoment, to: toMoment, raw: { from: timeOption.from, to: timeOption.to } };
};

export const stringToMoment = (
  value: string,
  isTimezoneUtc: boolean,
  roundUp?: boolean,
  timezone?: dateMath.Timezone
): Moment => {
  if (value.indexOf('now') !== -1) {
    if (!dateMath.isValid(value)) {
      return moment();
    }

    const parsed = dateMath.parse(value, roundUp, timezone);
    return parsed || moment();
  }

  if (isTimezoneUtc) {
    return moment.utc(value, TIME_FORMAT);
  }

  return moment(value, TIME_FORMAT);
};

export const mapTimeRangeToRangeString = (timeRange: TimeRange): string => {
  return describeTimeRange(timeRange.raw);
};

export const isValidTimeString = (text: string) => dateMath.isValid(text);
