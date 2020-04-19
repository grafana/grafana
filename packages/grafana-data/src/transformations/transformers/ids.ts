export enum DataTransformerID {
  // join = 'join', // Pick a field and merge all series based on that field
  append = 'append', // Merge all series together
  //  rotate = 'rotate', // Columns to rows
  reduce = 'reduce', // Run calculations on fields
  order = 'order', // order fields based on user configuration
  organize = 'organize', // order, rename and filter based on user configuration
  rename = 'rename', // rename field based on user configuration
  reduceByRow = 'reduceByRow', // Run a reducer on the row

  seriesToColumns = 'seriesToColumns', // former table transform timeseries_to_columns
  filterFields = 'filterFields', // Pick some fields (keep all frames)
  filterFieldsByName = 'filterFieldsByName', // Pick fields with name matching regex (keep all frames)
  filterFrames = 'filterFrames', // Pick some frames (keep all fields)
  filterByRefId = 'filterByRefId', // Pick some frames by RefId
  noop = 'noop', // Does nothing to the dataframe
}
