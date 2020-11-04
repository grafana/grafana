import { Field, ValueMatcherInfo } from '../../types';
import { ValueMatcherID } from './ids';

export interface ValueMatcherOptions {}

export interface BasicValueMatcherOptions<T> extends ValueMatcherOptions {
  value: T;
}

export interface RangeValueMatcherOptions<T> extends ValueMatcherOptions {
  from: T;
  to: T;
}

const isNullMatcher: ValueMatcherInfo<ValueMatcherOptions> = {
  id: ValueMatcherID.isNull,
  name: 'Is null',
  description: 'Match where value for given field is null.',
  get: () => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      return value === null;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is null.`;
  },
  isApplicable: () => true,
};

export const getNullValueMatchers = (): ValueMatcherInfo[] => [isNullMatcher];
