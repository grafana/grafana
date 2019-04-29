// This needs to be in its own file to avoid circular references

// A list of some (but not all) matcher IDs
export enum SeriesDataMatcherID {
  // Field Type
  numericFields = 'numericFields',
  timeFields = 'timeFields',
  fieldType = 'fieldType',

  // builtin predicates
  anyMatch = 'anyMatch',
  allMatch = 'allMatch',
  invertMatch = 'invertMatch',
  alwaysMatch = 'alwaysMatch',
  neverMatch = 'neverMatch',
}
