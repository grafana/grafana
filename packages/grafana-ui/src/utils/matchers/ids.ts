// This needs to be in its own file to avoid circular references

/**
 * The standard Series matchers.  Other matchers could be registered
 */
export enum SeriesMatcherID {
  // Field Type
  numericFields = 'numericFields',
  timeFields = 'timeFields',
  fieldType = 'fieldType',
  fieldName = 'fieldName',

  // builtin predicates
  anyMatch = 'anyMatch', // checks children
  allMatch = 'allMatch', // checks children
  invertMatch = 'invertMatch', // checks child
  alwaysMatch = 'alwaysMatch',
  neverMatch = 'neverMatch',
}
