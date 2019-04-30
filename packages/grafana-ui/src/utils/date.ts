import moment, { MomentInput, MomentFormatSpecification } from 'moment';
import { TIME_FORMAT } from './..';

export const momentUtc = (
  isUtc?: boolean,
  dateString?: MomentInput,
  format?: MomentFormatSpecification,
  strict?: boolean
) => {
  return isUtc ? moment.utc(dateString, format, strict) : moment(dateString, format, strict);
};

export const getRawRange = (isUtc: boolean, range: any) => {
  const rawRange = {
    from: range.raw.from,
    to: range.raw.to,
  };

  if (moment.isMoment(rawRange.from)) {
    if (!isUtc) {
      rawRange.from = rawRange.from.local();
    }
    rawRange.from = rawRange.from.format(TIME_FORMAT);
  }

  if (moment.isMoment(rawRange.to)) {
    if (!isUtc) {
      rawRange.to = rawRange.to.local();
    }
    rawRange.to = rawRange.to.format(TIME_FORMAT);
  }

  return rawRange;
};
