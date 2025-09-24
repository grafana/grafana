import { Field, FieldType } from '../../../types/dataFrame';
import { ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { RangeValueMatcherOptions } from './types';

const isBetweenValueMatcher: ValueMatcherInfo<RangeValueMatcherOptions> = {
  id: ValueMatcherID.between,
  name: 'Is between',
  description: 'Match when field value is between given option values.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      if (isNaN(value)) {
        return false;
      }

      // if it is a time, it is interpolated as a string, so convert before comparing
      const fromVal = typeof options.from !== 'number' ? parseInt(options.from, 10) : options.from;
      const toVal = typeof options.to !== 'number' ? parseInt(options.to, 10) : options.to;

      return value > fromVal && value < toVal;
    };
  },
  getOptionsDisplayText: (options) => {
    return `Matches all rows where field value is between ${options.from} and ${options.to}.`;
  },
  isApplicable: (field) => field.type === FieldType.number || field.type === FieldType.time,
  getDefaultOptions: (field) => {
    if (field.type === FieldType.time) {
      return { from: '$__from', to: '$__to' };
    } else {
      return { from: 0, to: 100 };
    }
  },
};

export const getRangeValueMatchers = (): ValueMatcherInfo[] => [isBetweenValueMatcher];
