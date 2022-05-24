import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { RangeValueMatcherOptions } from './types';

const isBetweenValueMatcher: ValueMatcherInfo<RangeValueMatcherOptions<number>> = {
  id: ValueMatcherID.between,
  name: 'Is between',
  description: 'Match when field value is between given option values.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values.get(valueIndex);
      if (isNaN(value)) {
        return false;
      }
      return value > options.from && value < options.to;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is between ${options.from} and ${options.to}.`;
  },
  isApplicable: (field) => field.type === FieldType.number,
  getDefaultOptions: () => ({ from: 0, to: 100 }),
};

export const getRangeValueMatchers = (): ValueMatcherInfo[] => [isBetweenValueMatcher];
