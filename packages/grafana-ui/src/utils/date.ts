import moment, { MomentInput, MomentFormatSpecification } from 'moment';
import { TIME_FORMAT } from './..';
import { RawTimeRange } from '../types/time';

export const momentUtc = (
  isUtc?: boolean,
  dateString?: MomentInput,
  format?: MomentFormatSpecification,
  strict?: boolean
) => {
  return isUtc ? moment.utc(dateString, format, strict) : moment(dateString, format, strict);
};

const getRawDateToShow = (isUtc: boolean, rawDate: moment.Moment | string): moment.Moment | string => {
  if (moment.isMoment(rawDate)) {
    const dateCopy = moment(rawDate); // Avoid mutating the original when doing .local()
    return !isUtc ? dateCopy.local() : dateCopy;
  }
  return rawDate;
};

const getFormattedRawDate = (rawDate: moment.Moment | string): string => {
  if (moment.isMoment(rawDate)) {
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
