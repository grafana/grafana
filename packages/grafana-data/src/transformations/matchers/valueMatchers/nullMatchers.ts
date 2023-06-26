import { Field } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { ValueMatcherOptions } from './types';

const isNullValueMatcher: ValueMatcherInfo<ValueMatcherOptions> = {
  id: ValueMatcherID.isNull,
  name: 'Is null',
  description: 'Match where value for given field is null.',
  get: () => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      return value == null;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is null.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({}),
};

const isNotNullValueMatcher: ValueMatcherInfo<ValueMatcherOptions> = {
  id: ValueMatcherID.isNotNull,
  name: 'Is not null',
  description: 'Match where value for given field is not null.',
  get: () => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      return value != null;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is not null.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({}),
};

export const getNullValueMatchers = (): ValueMatcherInfo[] => [isNullValueMatcher, isNotNullValueMatcher];
