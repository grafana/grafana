import { Field } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { BasicValueMatcherOptions } from './types';

const isEqualValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.equal,
  name: 'Is equal',
  description: 'Match where value for given field is equal to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      // eslint-disable-next-line eqeqeq
      return value == options.value;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is null.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({ value: '' }),
};

const isNotEqualValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.notEqual,
  name: 'Is not equal',
  description: 'Match where value for given field is not equal to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      // eslint-disable-next-line eqeqeq
      return value != options.value;
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is not null.`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({ value: '' }),
};

export const getEqualValueMatchers = (): ValueMatcherInfo[] => [isEqualValueMatcher, isNotEqualValueMatcher];
