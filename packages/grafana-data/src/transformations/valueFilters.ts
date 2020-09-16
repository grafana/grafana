import { Registry, RegistryItem } from '../utils/Registry';
import { FieldType } from '../types/dataFrame';

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
  range = 'range',
}

// The test function that will be called to see if the value matches or not
type ValueFilterTestFunction = (value: any) => boolean;

// The functino that will create and return the ValueFilterTestFunction built the filterOptions parameters
type ValueFilterInstanceCreator = (filterOptions: Record<string, any>) => ValueFilterInstance;

// The instance of the filter, with the test function and some validity info
export interface ValueFilterInstance {
  isValid: boolean;
  test: ValueFilterTestFunction;
  invalidArgs?: Record<string, boolean>;
  expression1Invalid?: boolean;
  expression2Invalid?: boolean;
}

//
// Test functions
//

function testRegexCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterArgs } = filterOptions;
  let regex = filterArgs?.regex ?? '';
  console.log('regex', regex);

  // The filter configuration
  const re = new RegExp(regex);

  return {
    isValid: true,
    test: value => {
      if (value === null) {
        return false;
      }
      return re.test(value);
    },
  };
}

function testIsNullCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  return {
    isValid: true,
    test: value => value === null,
  };
}

function testIsNotNullCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  return {
    isValid: true,
    test: value => value !== null,
  };
}

function testGreaterCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterArgs, fieldType } = filterOptions;
  let expression = filterArgs?.value || null;

  if (expression === '' || expression === null) {
    return { isValid: false, test: value => true };
  }

  let compare: any = null;

  // For a Number, compare as number
  if (fieldType === FieldType.number) {
    compare = Number(expression);
    if (isNaN(compare)) {
      compare = null;
    }
  }

  return {
    isValid: compare !== null,
    invalidArgs: { value: isNaN(expression) },
    test: value => value > compare,
  };
}

function testGreaterOrEqualCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterArgs, fieldType } = filterOptions;
  let expression = filterArgs?.value || null;

  if (expression === '' || expression === null) {
    return { isValid: false, test: value => true };
  }

  let compare: any = null;

  // For a Number, compare as number
  if (fieldType === FieldType.number) {
    compare = Number(expression);
    if (isNaN(compare)) {
      compare = null;
    }
  }

  return {
    isValid: compare !== null,
    test: value => value >= compare,
  };
}

function testLowerCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterArgs, fieldType } = filterOptions;
  let expression = filterArgs?.value || null;

  if (expression === '' || expression === null) {
    return { isValid: false, test: value => true };
  }

  let compare: any = null;

  // For a Number, compare as number
  if (fieldType === FieldType.number) {
    compare = Number(expression);
    if (isNaN(compare)) {
      compare = null;
    }
  }

  return {
    isValid: compare !== null,
    test: value => value < compare,
  };
}

function testLowerOrEqualCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let { filterArgs, fieldType } = filterOptions;
  let expression = filterArgs?.value || null;

  if (expression === '' || expression === null) {
    return { isValid: false, test: value => true };
  }

  let compare: any = null;

  // For a Number, compare as number
  if (fieldType === FieldType.number) {
    compare = Number(expression);
    if (isNaN(compare)) {
      compare = null;
    }
  }

  return {
    isValid: compare !== null,
    test: value => value <= compare,
  };
}

function testEqualCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let compare: any = filterOptions?.value || '';
  return {
    isValid: compare !== null,
    // eslint-disable-next-line eqeqeq
    test: value => value == compare, // Loose equality so we don't need to bother about types
  };
}

function testNotEqualCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  let compare: any = filterOptions?.value || '';
  return {
    isValid: compare !== null,
    // eslint-disable-next-line eqeqeq
    test: value => value != compare, // Loose equality so we don't need to bother about types
  };
}

function testRangeCreator(filterOptions: Record<string, any>): ValueFilterInstance {
  // We need a specific interval format : [min,max] or ]min,max[ (accepting spacing and +- before the values)
  let { max = null, min = null } = filterOptions.filterArgs;

  console.log(min, max);
  if (min === null || max === null || min === '' || max === '') {
    return {
      isValid: false,
      test: value => true,
    };
  }

  console.log(min, max);
  min = Number(min);
  max = Number(max);
  if (isNaN(min) || isNaN(max)) {
    return {
      isValid: false,
      invalidArgs: { min: isNaN(min), max: isNaN(min) },
      test: value => true,
    };
  }

  return {
    isValid: true,
    test: (value: any) => value >= min && value <= max,
  };
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

  placeholder?: string; // Place holder for filter expression input
  placeholder2?: string; // Second placeholder for 2 input fields
  getInstance: ValueFilterInstanceCreator;
  supportedFieldTypes?: FieldType[]; // If defined, support only those field types
}

export const valueFiltersRegistry = new Registry<ValueFilterInfo>(() => [
  {
    id: ValueFilterID.regex,
    name: 'Regex',
    getInstance: testRegexCreator,
    placeholder: 'Regular expression',
  },
  {
    id: ValueFilterID.isNull,
    name: 'Is Null',
    getInstance: testIsNullCreator,
  },
  {
    id: ValueFilterID.isNotNull,
    name: 'Is Not Null',
    getInstance: testIsNotNullCreator,
  },
  {
    id: ValueFilterID.greater,
    name: 'Greater',
    getInstance: testGreaterCreator,
    supportedFieldTypes: [FieldType.number],
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.greaterOrEqual,
    name: 'Greater or Equal',
    getInstance: testGreaterOrEqualCreator,
    supportedFieldTypes: [FieldType.number],
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.lower,
    name: 'Lower',
    getInstance: testLowerCreator,
    supportedFieldTypes: [FieldType.number],
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.lowerOrEqual,
    name: 'Lower or Equal',
    getInstance: testLowerOrEqualCreator,
    supportedFieldTypes: [FieldType.number],
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.equal,
    name: 'Equal',
    getInstance: testEqualCreator,
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.notEqual,
    name: 'Different',
    getInstance: testNotEqualCreator,
    placeholder: 'Value',
  },
  {
    id: ValueFilterID.range,
    name: 'Range',
    getInstance: testRangeCreator,
    placeholder: 'Min',
    placeholder2: 'Max',
  },
]);
