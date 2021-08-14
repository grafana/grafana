import { Field, ValueMatcherInfo } from '../../../types';
import { ValueMatcherID } from '../ids';
import { ValueMatcherOptions } from './types';

const isUndefinedMatcher: ValueMatcherInfo<ValueMatcherOptions> = {
  id: ValueMatcherID.isUndefined,
  name: 'Is undefined',
  description: 'Match where value for given field is undefined.',
  get: () => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      return value === undefined;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is undefined.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({}),
};

const isNotUndefinedMatcher: ValueMatcherInfo<ValueMatcherOptions> = {
  id: ValueMatcherID.isNotUndefined,
  name: 'Is not undefined',
  description: 'Match where value for given field is not undefined.',
  get: () => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      return value !== undefined;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is not undefined.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({}),
};

export const getUndefinedValueMatchers = (): ValueMatcherInfo[] => [isUndefinedMatcher, isNotUndefinedMatcher];
