import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';
import { BasicValueMatcherOptions } from './types';

const isGreaterValueMatcher: ValueMatcherInfo<BasicValueMatcherOptions<number>> = {
  id: ValueMatcherID.greater,
  name: 'Is greater',
  description: 'Match when field value is greater than option.',
  get: options => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (typeof value !== 'number') {
        return false;
      }
      return value > options.value;
    };
  },
  getOptionsDisplayText: options => {
    return `Matches all rows where field value is greater than: ${options.value}.`;
  },
  isApplicable: field => field.type === FieldType.number,
};

export const getNumericValueMatchers = (): ValueMatcherInfo[] => [isGreaterValueMatcher];
