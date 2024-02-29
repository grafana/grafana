import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { BasicValueMatcherOptions } from './types';

const isSubstringMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.substring,
  name: 'Contains Substring',
  description: 'Match where value for given field is a substring to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      return (value && value.includes(options.value)) || options.value === '';
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is similar to the value.`;
  },
  isApplicable: (field) => field.type === FieldType.string,
  getDefaultOptions: () => ({ value: '' }),
};

const isNotSubstringValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.notSubstring,
  name: 'Does not contain substring',
  description: 'Match where value for given field is not a substring to options value.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      return typeof value === 'string' && options.value !== '' && !value.includes(options.value);
    };
  },
  getOptionsDisplayText: () => {
    return `Matches all rows where field is not similar to the value.`;
  },
  isApplicable: (field) => field.type === FieldType.string,
  getDefaultOptions: () => ({ value: '' }),
};

export const getSubstringValueMatchers = (): ValueMatcherInfo[] => [isSubstringMatcher, isNotSubstringValueMatcher];
