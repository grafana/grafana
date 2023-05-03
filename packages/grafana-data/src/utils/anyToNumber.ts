import { toNumber } from 'lodash';

/**
 * Will return any value as a number or NaN
 *
 * @internal
 * */
export function anyToNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (value === '' || value === null || value === undefined || Array.isArray(value)) {
    return NaN; // lodash calls them 0
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return toNumber(value);
}
