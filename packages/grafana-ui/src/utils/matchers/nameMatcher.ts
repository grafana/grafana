import { Field, SeriesData } from '../../types/data';
import { SeriesMatcherInfo } from './matchers';
import { SeriesMatcherID } from './ids';
import { stringToJsRegex } from '../string';

// General Field matcher
const fieldNameMacher: SeriesMatcherInfo<string> = {
  id: SeriesMatcherID.fieldName,
  name: 'Field Name',
  description: 'match the field name',
  defaultOptions: '/.*/',

  matcher: (pattern: string) => {
    const regex = stringToJsRegex(pattern);
    return (series: SeriesData, field?: Field) => {
      if (!field) {
        return true;
      }
      return regex.test(field.name);
    };
  },

  getOptionsDisplayText: (pattern: string) => {
    return `Field name: ${pattern}`;
  },
};

/**
 * Registry Initalization
 */
export function getNameMatchers(): SeriesMatcherInfo[] {
  return [fieldNameMacher];
}
