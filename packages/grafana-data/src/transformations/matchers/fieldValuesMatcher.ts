import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo, ValueMatcherInfo } from '../../types/transformations';
import { getValueMatcher } from '../matchers';

import { FieldMatcherID } from './ids';

export interface FieldMatcherOptions {
  valueMatcherConfig: ValueMatcherInfo;
}

const fieldAllValuesMatcher: FieldMatcherInfo<FieldMatcherOptions> = {
  id: FieldMatcherID.allValues,
  name: 'All values',
  description: 'All values satisfy condition',

  get: (options: FieldMatcherOptions) => {
    const valueMatcher = getValueMatcher(options.valueMatcherConfig);

    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      let i = 0;
      while (i < field.values.length) {
        if (!valueMatcher(i, field, frame, allFrames)) {
          return false;
        }
        i++;
      }
      return true;
    };
  },

  getOptionsDisplayText: () => {
    return `First field`;
  },
};

/**
 * Registry Initialization
 */
export function getFieldValuesMatchers(): FieldMatcherInfo[] {
  return [fieldAllValuesMatcher];
}
