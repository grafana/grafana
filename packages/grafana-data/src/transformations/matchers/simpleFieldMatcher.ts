import { Field, FieldType, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';

import { FieldMatcherID } from './ids';

const firstFieldMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.first,
  name: 'First Field',
  description: 'The first field in the frame',

  get: (type: FieldType) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return field === frame.fields[0];
    };
  },

  getOptionsDisplayText: () => {
    return `First field`;
  },
};

const firstTimeFieldMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.firstTimeField,
  name: 'First time field',
  description: 'The first field of type time in a frame',

  get: (type: FieldType) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return field.type === FieldType.time && field === frame.fields.find((f) => f.type === FieldType.time);
    };
  },

  getOptionsDisplayText: () => {
    return `First time field`;
  },
};

/**
 * Registry Initialization
 */
export function getSimpleFieldMatchers(): FieldMatcherInfo[] {
  return [firstFieldMatcher, firstTimeFieldMatcher];
}
