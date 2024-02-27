import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { BasicValueMatcherOptions } from './types';

const isLikeValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.substring,
  name: 'Is Substring',
  description: 'Match where value for given field is a substring to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      // eslint-disable-next-line eqeqeq
      return value.includes(options.value);
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is similar to the value.`;
  },
  isApplicable: (field) => field.type === FieldType.string,
  getDefaultOptions: () => ({ value: '' }),
};

const isNotLikeValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.notSubstring,
  name: 'Is not substring',
  description: 'Match where value for given field is not a substring to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      // eslint-disable-next-line eqeqeq

      // compare value to options.value, if
      return !value.includes(options.value);
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is not similar to the value.`;
  },
  isApplicable: (field) => field.type === FieldType.string,
  getDefaultOptions: () => ({ value: '' }),
};

export const getSubstringValueMatchers = (): ValueMatcherInfo[] => [isLikeValueMatcher, isNotLikeValueMatcher];
