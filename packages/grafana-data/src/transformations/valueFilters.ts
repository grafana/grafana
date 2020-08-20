// import isNumber from 'lodash/isNumber';
import { Registry, RegistryItem } from '../utils/Registry';

export enum ValueFilterID {
  regex = 'regex',
  isNull = 'isNull',
  isNotNull = 'isNotNull',
  greater = 'greater',
  greaterOrEqual = 'greaterOrEqual',
  lower = 'lower',
  lowerOrEqual = 'lowerOrEqual',
  equal = 'equal',
  notEqual = 'notEqual',
}

type ValueFilterTestFunction = (value: any, filterExpression: string) => boolean;

export interface ValueFilterInfo extends RegistryItem {
  // Inherited fom RegistryItem
  // 	 id: string; // Unique Key -- saved in configs
  // 	 name: string; // Display Name, can change without breaking configs
  // 	 description?: string;
  // 	 aliasIds?: string[]; // when the ID changes, we may want backwards compatibility ('current' => 'last')
  // 	 excludeFromPicker?: boolean; // Exclude from selector options

  test: ValueFilterTestFunction;
}

//
// Test functions
//

function testRegex(value: any, filterExpression: string): boolean {
  let re = new RegExp(filterExpression);
  return re.test(value);
}

//
//	List of value filters (Registry)
//

export const valueFiltersRegistry = new Registry<ValueFilterInfo>(() => [
  {
    id: ValueFilterID.regex,
    name: 'Regex',
    test: testRegex,
  },
  {
    id: ValueFilterID.isNull,
    name: 'isNull',
    test: testRegex,
  },
]);
