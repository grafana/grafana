import { type Field, FieldType } from '../../../types/dataFrame';
import { type ValueMatcherInfo } from '../../../types/transformations';
import { ValueMatcherID } from '../ids';

import { type RangeValueMatcherOptions } from './types';

const isBetweenValueMatcher: ValueMatcherInfo<RangeValueMatcherOptions> = {
  id: ValueMatcherID.between,
  name: 'Is between',
  description: 'Match when field value is between given option values.',
  get: (options) => {
    return (valueIndex: number, field: Field) => {
      const value = field.values[valueIndex];
      if (options.includeMissing !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
        return options.includeMissing;
      }
      if (isNaN(value)) {
        return false;
      }

      // if it is a time, it is interpolated as a string, so convert before comparing
      const fromVal = typeof options.from !== 'number' ? parseInt(options.from, 10) : options.from;
      const toVal = typeof options.to !== 'number' ? parseInt(options.to, 10) : options.to;

      const aboveFrom =
        (options.allowOpenBounds && options.from === undefined) ||
        (options.inclusive ? value >= fromVal : value > fromVal);
      const belowTo =
        (options.allowOpenBounds && options.to === undefined) || (options.inclusive ? value <= toVal : value < toVal);
      return aboveFrom && belowTo;
    };
  },
  getOptionsDisplayText: (options) => {
    const from = options.allowOpenBounds && options.from === undefined ? '-∞' : options.from;
    const to = options.allowOpenBounds && options.to === undefined ? '∞' : options.to;
    const inclusive = options.inclusive ? ' (inclusive)' : '';
    const missing =
      options.includeMissing === undefined
        ? ''
        : options.includeMissing
          ? ' Includes missing, non-numeric and non-finite values.'
          : ' Finite numbers only.';
    return `Matches all rows where field value is between ${from} and ${to}${inclusive}.${missing}`;
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
