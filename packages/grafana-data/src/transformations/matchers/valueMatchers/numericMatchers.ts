import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { BasicValueMatcherOptions } from './types';

const isGreaterValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<number>> = {
  id: ValueMatcherID.greater,
  name: 'Is greater',
  description: 'Match when field value is greater than option.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (isNaN(value)) {
        return false;
      }
      return value > options.value;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is greater than: ${options.value}.`;
  },
  isApplicable: (field) => field.type === FieldType.number,
  getDefaultOptions: () => ({ value: 0 }),
};

const isGreaterOrEqualValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<number>> = {
  id: ValueMatcherID.greaterOrEqual,
  name: 'Is greater or equal',
  description: 'Match when field value is greater than or equal to option.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (isNaN(value)) {
        return false;
      }
      return value >= options.value;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is greater than or equal to: ${options.value}.`;
  },
  isApplicable: (field) => field.type === FieldType.number,
  getDefaultOptions: () => ({ value: 0 }),
};

const isLowerValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<number>> = {
  id: ValueMatcherID.lower,
  name: 'Is lower',
  description: 'Match when field value is lower than option.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (isNaN(value)) {
        return false;
      }
      return value < options.value;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is lower than: ${options.value}.`;
  },
  isApplicable: (field) => field.type === FieldType.number,
  getDefaultOptions: () => ({ value: 0 }),
};

const isLowerOrEqualValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<number>> = {
  id: ValueMatcherID.lowerOrEqual,
  name: 'Is lower or equal',
  description: 'Match when field value is lower or equal than option.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (isNaN(value)) {
        return false;
      }
      return value <= options.value;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is lower or equal than: ${options.value}.`;
  },
  isApplicable: (field) => field.type === FieldType.number,
  getDefaultOptions: () => ({ value: 0 }),
};

export const getNumericValueMatchers = (): ValueMatcherInfo[] => [
  isGreaterValueMatcher,
  isGreaterOrEqualValueMatcher,
  isLowerValueMatcher,
  isLowerOrEqualValueMatcher,
];
