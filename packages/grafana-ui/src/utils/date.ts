import { dateTime, isDateTime, DateTime } from './moment_wrapper';
import { TIME_FORMAT } from './..';
import { RawTimeRange } from '../types/time';

const getRawDateToShow = (isUtc: boolean, rawDate: DateTime | string): DateTime | string => {
  if (isDateTime(rawDate)) {
    const dateCopy = dateTime(rawDate); // Avoid mutating the original when doing .local()
    return !isUtc ? dateCopy.local() : dateCopy;
  }
  return rawDate;
};

const getFormattedRawDate = (rawDate: DateTime | string): string => {
  if (isDateTime(rawDate)) {
    return rawDate.format(TIME_FORMAT);
  }
  return rawDate;
};

interface FormattedRangeToShow {
  to: string;
  from: string;
}

export const getFormattedRangeToShow = (isUtc: boolean, rawTimeRange: RawTimeRange): FormattedRangeToShow => {
  return {
    from: getFormattedRawDate(getRawDateToShow(isUtc, rawTimeRange.from)),
    to: getFormattedRawDate(getRawDateToShow(isUtc, rawTimeRange.to)),
  };
};

export const getRawTimeRangeToShow = (isUtc: boolean, rawTimeRange: RawTimeRange): RawTimeRange => {
  return {
    from: getRawDateToShow(isUtc, rawTimeRange.from),
    to: getRawDateToShow(isUtc, rawTimeRange.to),
  };
};
