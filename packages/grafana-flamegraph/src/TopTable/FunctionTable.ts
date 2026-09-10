/** Per-function values aggregated independently of the displayed flamegraph. */
export interface FunctionTable {
  rows: FunctionTableRow[];
  /** Full profile total before limiting or filtering rows; baseline total for a diff. */
  total: number;
  /** Full comparison profile total. Its presence identifies a diff table, including an empty comparison. */
  totalRight?: number;
}

export interface FunctionTableRow {
  name: string;
  self: number;
  total: number;
  selfRight?: number;
  totalRight?: number;
}
