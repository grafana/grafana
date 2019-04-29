import { Field, SeriesData } from '../../types/data';
import { FieldType } from '../../types/data';
import { SeriesDataMatcher } from './matchers';
import { SeriesDataMatcherID } from './ids';

// General Field matcher
const fieldTypeMacher: SeriesDataMatcher<FieldType> = {
  id: SeriesDataMatcherID.fieldType,
  name: 'Field Type',
  description: 'match based on the field type',
  defaultOptions: FieldType.number,

  matches: (type: FieldType, series: SeriesData, field?: Field) => {
    if (!field) {
      return true; // Match all series
    }
    return type === field.type;
  },

  getOptionsDisplayText: (type: FieldType) => {
    return `Field type: ${type}`;
  },
};

// Numeric Field matcher
// This gets its own entry so it shows up in the dropdown
const numericMacher: SeriesDataMatcher<FieldType> = {
  id: SeriesDataMatcherID.numericFields,
  name: 'Numeric Fields',
  description: 'Fields with type number',

  matches: (opts: any, series: SeriesData, field?: Field) => {
    return !field || FieldType.number === field.type;
  },

  getOptionsDisplayText: (opts: any) => {
    return 'Numeric Fields';
  },
};

// Time Field matcher
const timeMacher: SeriesDataMatcher<FieldType> = {
  id: SeriesDataMatcherID.timeFields,
  name: 'Time Fields',
  description: 'Fields with type time',

  matches: (opts: any, series: SeriesData, field?: Field) => {
    return !field || FieldType.time === field.type;
  },

  getOptionsDisplayText: (opts: any) => {
    return 'Time Fields';
  },
};

/**
 * Registry Initalization
 */
export function getFieldTypeMatchers(): SeriesDataMatcher[] {
  return [fieldTypeMacher, numericMacher, timeMacher];
}
