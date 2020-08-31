export enum DataTransformerID {
  // join = 'join', // Pick a field and merge all series based on that field
  append = 'append',
  //  rotate = 'rotate', // Columns to rows
  reduce = 'reduce',
  order = 'order',
  organize = 'organize',
  rename = 'rename',
  calculateField = 'calculateField',
  seriesToColumns = 'seriesToColumns',
  seriesToRows = 'seriesToRows',
  merge = 'merge',
  labelsToFields = 'labelsToFields',
  filterFields = 'filterFields',
  filterFieldsByName = 'filterFieldsByName',
  filterFrames = 'filterFrames',
  filterByRefId = 'filterByRefId',
  noop = 'noop',
  ensureColumns = 'ensureColumns',
  groupBy = 'groupBy',
}
