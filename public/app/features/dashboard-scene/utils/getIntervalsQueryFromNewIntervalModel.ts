// Transform new interval scene model to old interval core model
export function getIntervalsQueryFromNewIntervalModel(intervals: string[]): string {
  const variableQuery = Array.isArray(intervals) ? intervals.join(',') : '';
  return variableQuery;
}
