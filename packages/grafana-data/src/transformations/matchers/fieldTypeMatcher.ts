import { Field, FieldType, DataFrame } from '../../types/dataFrame';
import { FieldMatcherID } from './ids';
import { FieldMatcherInfo } from '../../types/transformations';

// General Field matcher
const fieldTypeMatcher: FieldMatcherInfo<FieldType> = {
  id: FieldMatcherID.byType,
  name: 'Field Type',
  description: 'match based on the field type',
  defaultOptions: FieldType.number,

  get: (type: FieldType) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return type === field.type;
    };
  },

  getOptionsDisplayText: (type: FieldType) => {
    return `Field type: ${type}`;
  },
};

// Numeric Field matcher
// This gets its own entry so it shows up in the dropdown
const numericMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.numeric,
  name: 'Numeric Fields',
  description: 'Fields with type number',

  get: () => {
    return fieldTypeMatcher.get(FieldType.number);
  },

  getOptionsDisplayText: () => {
    return 'Numeric Fields';
  },
};

// Time Field matcher
const timeMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.time,
  name: 'Time Fields',
  description: 'Fields with type time',

  get: () => {
    return fieldTypeMatcher.get(FieldType.time);
  },

  getOptionsDisplayText: () => {
    return 'Time Fields';
  },
};

/**
 * Registry Initialization
 */
export function getFieldTypeMatchers(): FieldMatcherInfo[] {
  return [fieldTypeMatcher, numericMatcher, timeMatcher];
}
