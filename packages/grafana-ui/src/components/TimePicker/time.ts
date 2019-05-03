import { TimeOption, TimeRange, TIME_FORMAT } from '../../types/time';
import { describeTimeRange } from '../../utils/rangeutil';
import * as dateMath from '../../utils/datemath';
import { momentWrapper, DateTimeType, toUtc } from 'app/core/moment_wrapper';

export const mapTimeOptionToTimeRange = (
  timeOption: TimeOption,
  isTimezoneUtc: boolean,
  timezone?: dateMath.Timezone
): TimeRange => {
  const fromMoment = stringToDateTimeType(timeOption.from, isTimezoneUtc, false, timezone);
  const toMoment = stringToDateTimeType(timeOption.to, isTimezoneUtc, true, timezone);

  return { from: fromMoment, to: toMoment, raw: { from: timeOption.from, to: timeOption.to } };
};

export const stringToDateTimeType = (
  value: string,
  isTimezoneUtc: boolean,
  roundUp?: boolean,
  timezone?: dateMath.Timezone
): DateTimeType => {
  if (value.indexOf('now') !== -1) {
    if (!dateMath.isValid(value)) {
      return momentWrapper();
    }

    const parsed = dateMath.parse(value, roundUp, timezone);
    return parsed || momentWrapper();
  }

  if (isTimezoneUtc) {
    return toUtc(value, TIME_FORMAT);
  }

  return momentWrapper(value, TIME_FORMAT);
};

export const mapTimeRangeToRangeString = (timeRange: TimeRange): string => {
  return describeTimeRange(timeRange.raw);
};

export const isValidTimeString = (text: string) => dateMath.isValid(text);
