import { Field, FieldType } from '../../types/dataFrame';
import { FieldMatcherID } from './ids';
import { FieldMatcherInfo } from '../../types/transformations';

// General Field matcher
const fieldTypeMacher: FieldMatcherInfo<FieldType> = {
  id: FieldMatcherID.byType,
  name: 'Field Type',
  description: 'match based on the field type',
  defaultOptions: FieldType.number,

  get: (type: FieldType) => {
    return (field: Field) => {
      return type === field.type;
    };
  },

  getOptionsDisplayText: (type: FieldType) => {
    return `Field type: ${type}`;
  },
};

// Numeric Field matcher
// This gets its own entry so it shows up in the dropdown
const numericMacher: FieldMatcherInfo = {
  id: FieldMatcherID.numeric,
  name: 'Numeric Fields',
  description: 'Fields with type number',

  get: () => {
    return fieldTypeMacher.get(FieldType.number);
  },

  getOptionsDisplayText: () => {
    return 'Numeric Fields';
  },
};

// Time Field matcher
const timeMacher: FieldMatcherInfo = {
  id: FieldMatcherID.time,
  name: 'Time Fields',
  description: 'Fields with type time',

  get: () => {
    return fieldTypeMacher.get(FieldType.time);
  },

  getOptionsDisplayText: () => {
    return 'Time Fields';
  },
};

/**
 * Registry Initalization
 */
export function getFieldTypeMatchers(): FieldMatcherInfo[] {
  return [fieldTypeMacher, numericMacher, timeMacher];
}
