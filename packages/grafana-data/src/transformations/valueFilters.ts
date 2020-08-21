import isNumber from 'lodash/isNumber';
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

// The test function that will be called to see if the value matches or not
type ValueFilterTestFunction = (value: any) => boolean;

// The functino that will create and return the ValueFilterTestFunction built the filterOptions parameters
type ValueFilterInstanceCreator = (filterOptions: Record<string, any>) => ValueFilterInstance;

// The instance of the filter, with the test function and some validity info
export interface ValueFilterInstance {
  test: ValueFilterTestFunction;
  isValid: boolean;
}

//
// Test functions
//

function testRegexCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterExpression } = filterOptions;

  if (!filterExpression) {
    filterExpression = '';
  }

  // The filter configuration
  const re = new RegExp(filterExpression);
  console.log(filterOptions, filterExpression, re);

  // The test function
  const test = value => {
    return re.test(value);
  };

  return { test, isValid: true };
}

function testIsNull(value: any, filterExpression: string | null): boolean {
  return value === null;
}

function testIsNotNull(value: any, filterExpression: string | null): boolean {
  return !testIsNull(value, filterExpression);
}

function testGreater(value: any, filterExpression: string | null): boolean {
  if (value === null) {
    return true;
  }

  return false;
}

//
//	List of value filters (Registry)
//

// The type that fills the registry of available ValueFilters, with their id, definition, description, etc.
export interface ValueFilterInfo extends RegistryItem {
  // Inherited fom RegistryItem
  //   id: string; // Unique Key -- saved in configs
  //   name: string; // Display Name, can change without breaking configs
  //   description?: string;
  //   aliasIds?: string[]; // when the ID changes, we may want backwards compatibility ('current' => 'last')
  //   excludeFromPicker?: boolean; // Exclude from selector options

  getInstance: ValueFilterInstanceCreator;
}

export const valueFiltersRegistry = new Registry<ValueFilterInfo>(() => [
  {
    id: ValueFilterID.regex,
    name: 'Regex',
    getInstance: testRegexCreator,
  },
  // {
  //   id: ValueFilterID.isNull,
  //   name: 'isNull',
  //   test: testIsNull,
  // },
]);
