import { DurationUnit } from '../types';

/**
 * Moment supports some shorthands units.
 *
 * Ref: https://momentjs.com/docs/#/manipulating/add/
 */
export const looseMomentDurationUnitsToLuxon = (unit: DurationUnit) => {
  switch (unit) {
    case 'y':
    case 'year':
    case 'years':
      return 'years';
    case 'M':
    case 'month':
    case 'months':
      return 'months';
    case 'Q':
    case 'quarter':
    case 'quarters':
      return 'quarters';
    case 'w':
    case 'week':
    case 'weeks':
    case 'isoWeek':
      return 'weeks';
    case 'd':
    case 'day':
    case 'days':
      return 'days';
    case 'h':
    case 'hour':
    case 'hours':
      return 'hours';
    case 'm':
    case 'minute':
    case 'minutes':
      return 'minutes';
    case 's':
    case 'second':
    case 'seconds':
      return 'seconds';
    default:
      return 'milliseconds';
  }
};
