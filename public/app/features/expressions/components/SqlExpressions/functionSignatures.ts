import { type SqlFunctionSignature } from './SqlEditor/signatureHelp';

/**
 * Curated signature metadata for the most common SQL Expression functions.
 *
 * This is intentionally a subset of ALLOWED_FUNCTIONS (see
 * ../../utils/metaSqlExpr). To add signature help for another allowed function,
 * append an entry here with its parameters and return type.
 */
export const FUNCTION_SIGNATURES: SqlFunctionSignature[] = [
  // Math
  {
    name: 'abs',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the absolute value of a number.',
  },
  {
    name: 'round',
    parameters: [{ label: 'value: number' }, { label: 'decimals: number', documentation: 'Number of decimal places.' }],
    returnType: 'number',
    documentation: 'Rounds a number to the given number of decimal places.',
  },
  {
    name: 'ceil',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the smallest integer greater than or equal to the value.',
  },
  {
    name: 'floor',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the largest integer less than or equal to the value.',
  },
  {
    name: 'truncate',
    parameters: [{ label: 'value: number' }, { label: 'decimals: number', documentation: 'Number of decimal places.' }],
    returnType: 'number',
    documentation: 'Truncates a number to the given number of decimal places.',
  },
  {
    name: 'sqrt',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the square root of a number.',
  },
  {
    name: 'pow',
    parameters: [{ label: 'base: number' }, { label: 'exponent: number' }],
    returnType: 'number',
    documentation: 'Returns base raised to the power of exponent.',
  },
  {
    name: 'mod',
    parameters: [{ label: 'dividend: number' }, { label: 'divisor: number' }],
    returnType: 'number',
    documentation: 'Returns the remainder of dividend divided by divisor.',
  },
  {
    name: 'log',
    parameters: [{ label: 'value: number' }, { label: 'base: number', documentation: 'Optional logarithm base.' }],
    returnType: 'number',
    documentation: 'Returns the natural logarithm, or the logarithm to the given base.',
  },

  // Conditional / null handling
  {
    name: 'if',
    parameters: [
      { label: 'condition: boolean' },
      { label: 'then: any', documentation: 'Value returned when the condition is true.' },
      { label: 'else: any', documentation: 'Value returned when the condition is false.' },
    ],
    returnType: 'any',
    documentation: 'Returns then when the condition is true, otherwise else.',
  },
  {
    name: 'ifnull',
    parameters: [{ label: 'value: any' }, { label: 'fallback: any' }],
    returnType: 'any',
    documentation: 'Returns fallback when value is NULL, otherwise value.',
  },
  {
    name: 'nullif',
    parameters: [{ label: 'value: any' }, { label: 'compare: any' }],
    returnType: 'any',
    documentation: 'Returns NULL when the two arguments are equal, otherwise value.',
  },
  {
    name: 'coalesce',
    parameters: [{ label: 'value: any' }, { label: '...values: any', documentation: 'Additional fallback values.' }],
    returnType: 'any',
    documentation: 'Returns the first non-NULL value from the arguments.',
  },

  // Aggregates
  {
    name: 'avg',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the average of all values in the group.',
  },
  {
    name: 'sum',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the sum of all values in the group.',
  },
  {
    name: 'min',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the minimum value in the group.',
  },
  {
    name: 'max',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the maximum value in the group.',
  },
  {
    name: 'count',
    parameters: [{ label: 'value: any' }],
    returnType: 'number',
    documentation: 'Returns the number of rows or non-NULL values in the group.',
  },

  // Strings
  {
    name: 'concat',
    parameters: [{ label: 'value: any' }, { label: '...values: any', documentation: 'Additional values to append.' }],
    returnType: 'string',
    documentation: 'Concatenates the arguments into a single string.',
  },
  {
    name: 'substring',
    parameters: [
      { label: 'value: string' },
      { label: 'start: number', documentation: 'One-based start position.' },
      { label: 'length: number', documentation: 'Optional number of characters.' },
    ],
    returnType: 'string',
    documentation: 'Extracts a substring starting at the given position.',
  },
  {
    name: 'replace',
    parameters: [{ label: 'value: string' }, { label: 'from: string' }, { label: 'to: string' }],
    returnType: 'string',
    documentation: 'Replaces all occurrences of from with to in the string.',
  },
];
