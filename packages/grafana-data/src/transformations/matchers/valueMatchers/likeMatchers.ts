import { Field } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { BasicValueMatcherOptions } from './types';

const isLikeValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
  id: ValueMatcherID.like,
  name: 'Is like',
  description: 'Match where value for given field is similar to options value.',
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
  isApplicable: () => true,
  getDefaultOptions: () => ({ value: '' }),
};

const isNotLikeValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions> = {
    id: ValueMatcherID.notLike,
    name: 'Is not like',
    description: 'Match where value for given field is not similar to options value.',
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
    isApplicable: () => true,
    getDefaultOptions: () => ({ value: '' }),
    };

export const getLikeValueMatchers = (): ValueMatcherInfo[] => [isLikeValueMatcher, isNotLikeValueMatcher];
