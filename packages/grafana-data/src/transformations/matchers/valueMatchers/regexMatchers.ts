import { type Field } from '../../../types/dataFrame';
import { type ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { type BasicValueMatcherOptions } from './types';

const regexValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<string>> = {
  id: ValueMatcherID.regex,
  name: 'Regex',
  description: 'Match when field value is matching regex.',
  get: (options) => {
    const regex = new RegExp(options.value);

    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      return regex.test(value);
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is matching regex: ${options.value}`;
  },
  isApplicable: () => true,
  getDefaultOptions: () => ({ value: '.*' }),
};

export const getRegexValueMatcher = (): ValueMatcherInfo[] => [regexValueMatcher];
