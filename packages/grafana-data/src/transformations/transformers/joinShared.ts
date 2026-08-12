export enum JoinMode {
  outer = 'outer', // best for time series, non duplicated join on values
  inner = 'inner',
  outerTabular = 'outerTabular', // best for tabular data where the join on value can be duplicated
}
