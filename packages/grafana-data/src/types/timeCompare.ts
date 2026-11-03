/**
 * Frame metadata marking a series as the result of a time comparison query.
 * Set by the compare query processor and consumed when aligning and rendering compare series.
 */
export interface TimeCompareMeta {
  /** Signed offset between the compare range and the primary range. */
  diffMs: number;
  isTimeShiftQuery: boolean;
}
