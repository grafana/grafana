import { Field, SeriesData } from '../../types/data';
import { FieldType } from '../../types/data';
import { SeriesMatcherInfo } from './matchers';
import { SeriesMatcherID } from './ids';

// General Field matcher
const fieldTypeMacher: SeriesMatcherInfo<FieldType> = {
  id: SeriesMatcherID.fieldType,
  name: 'Field Type',
  description: 'match based on the field type',
  defaultOptions: FieldType.number,

  matcher: (type: FieldType) => {
    return (series: SeriesData, field?: Field) => {
      if (!field) {
        return true; // Match all series
      }
      return type === field.type;
    };
  },

  getOptionsDisplayText: (type: FieldType) => {
    return `Field type: ${type}`;
  },
};

// Numeric Field matcher
// This gets its own entry so it shows up in the dropdown
const numericMacher: SeriesMatcherInfo<any> = {
  id: SeriesMatcherID.numericFields,
  name: 'Numeric Fields',
  description: 'Fields with type number',

  matcher: () => {
    return fieldTypeMacher.matcher(FieldType.number);
  },

  getOptionsDisplayText: () => {
    return 'Numeric Fields';
  },
};

// Time Field matcher
const timeMacher: SeriesMatcherInfo<FieldType> = {
  id: SeriesMatcherID.timeFields,
  name: 'Time Fields',
  description: 'Fields with type time',

  matcher: () => {
    return fieldTypeMacher.matcher(FieldType.time);
  },

  getOptionsDisplayText: () => {
    return 'Time Fields';
  },
};

/**
 * Registry Initalization
 */
export function getFieldTypeMatchers(): SeriesMatcherInfo[] {
  return [fieldTypeMacher, numericMacher, timeMacher];
}
