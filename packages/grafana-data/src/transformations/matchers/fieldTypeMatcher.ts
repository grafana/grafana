import { Field, FieldType, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';

import { FieldMatcherID } from './ids';

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

// General Field matcher (multiple types)
const fieldTypesMatcher: FieldMatcherInfo<Set<FieldType>> = {
  id: FieldMatcherID.byTypes,
  name: 'Field Type',
  description: 'match based on the field types',
  defaultOptions: new Set(),

  get: (types) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      return types.has(field.type);
    };
  },

  getOptionsDisplayText: (types) => {
    return `Field types: ${[...types].join(' | ')}`;
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
  return [fieldTypeMatcher, fieldTypesMatcher, numericMatcher, timeMatcher];
}
