import { Field, FieldType, DataFrame } from '../../types/dataFrame';
import { FieldMatcherID } from './ids';
import { FieldMatcherInfo } from '../../types/transformations';

const firstFieldMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.byType,
  name: 'First Field',
  description: 'The first field in the frame',
  defaultOptions: FieldType.number,

  get: (type: FieldType) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return field === frame.fields[0];
    };
  },

  getOptionsDisplayText: () => {
    return `First field`;
  },
};

/**
 * Registry Initialization
 */
export function getSimpleFieldMatchers(): FieldMatcherInfo[] {
  return [firstFieldMatcher];
}
