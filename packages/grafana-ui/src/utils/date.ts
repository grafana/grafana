import moment, { MomentInput, MomentFormatSpecification } from 'moment';

export const momentUtc = (
  isUtc?: boolean,
  dateString?: MomentInput,
  format?: MomentFormatSpecification,
  strict?: boolean
) => {
  return isUtc ? moment.utc(dateString, format, strict) : moment(dateString, format, strict);
};
