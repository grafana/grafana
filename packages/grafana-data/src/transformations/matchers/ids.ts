// This needs to be in its own file to avoid circular references

// Builtin Predicates
// not using 'any' and 'never' since they are reserved keywords
export enum MatcherID {
  anyMatch = 'anyMatch', // checks children
  allMatch = 'allMatch', // checks children
  invertMatch = 'invertMatch', // checks child
  alwaysMatch = 'alwaysMatch',
  neverMatch = 'neverMatch',
}

export enum FieldMatcherID {
  // Specific Types
  numeric = 'numeric',
  time = 'time', // Can be multiple times
  first = 'first',
  firstTimeField = 'firstTimeField', // Only the first fime field

  // With arguments
  byType = 'byType',
  byName = 'byName',
  byNames = 'byNames',
  byRegexp = 'byRegexp',
  byRegexpOrNames = 'byRegexpOrNames',
  byFrameRefID = 'byFrameRefID',
  // byIndex = 'byIndex',
  // byLabel = 'byLabel',
}

/**
 * Field name matchers
 */
export enum FrameMatcherID {
  byName = 'byName',
  byRefId = 'byRefId',
  byIndex = 'byIndex',
  byLabel = 'byLabel',
}

/**
 * @public
 */
export enum ValueMatcherID {
  regex = 'regex',
  isNull = 'isNull',
  isNotNull = 'isNotNull',
  greater = 'greater',
  greaterOrEqual = 'greaterOrEqual',
  lower = 'lower',
  lowerOrEqual = 'lowerOrEqual',
  equal = 'equal',
  notEqual = 'notEqual',
  between = 'between',
}
