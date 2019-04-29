export enum SeriesTransformerID {
  join = 'join', // Pick a field and merge all series based on that field
  append = 'append', // Merge all series together
  rotate = 'rotate', // Columns to rows
  calc = 'calc', // Run calculations on fields
  filter = 'filter', // Pick some fields

  // Future
  extract = 'extract', // regex within field to create new fields
  math = 'match', // Do math on the fields
}
