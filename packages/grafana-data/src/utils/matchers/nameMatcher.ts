import { Field, DataFrame } from '../../types/dataFrame';
import { DataMatcherInfo } from './matchers';
import { DataMatcherID } from './ids';
import { stringToJsRegex } from '../string';

// General Field matcher
const fieldNameMacher: DataMatcherInfo<string> = {
  id: DataMatcherID.fieldName,
  name: 'Field Name',
  description: 'match the field name',
  defaultOptions: '/.*/',

  matcher: (pattern: string) => {
    const regex = stringToJsRegex(pattern);
    return (data: DataFrame, field?: Field) => {
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
export function getNameMatchers(): DataMatcherInfo[] {
  return [fieldNameMacher];
}
