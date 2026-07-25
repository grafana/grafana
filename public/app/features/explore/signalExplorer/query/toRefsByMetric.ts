/**
 * Inverts the `{ refId: metricNames[] }` shape `detectMetricsInQueries` returns into the
 * `{ metricName: refIds[] }` shape the metric rows badge off. The two are structurally identical
 * (`Record<string, string[]>`), so passing one where the other is expected type-checks and silently
 * badges nothing — hence this explicit step rather than an inline map.
 */
export function toRefsByMetric(metricsByRefId: Record<string, string[]>): Record<string, string[]> {
  const refsByMetric: Record<string, string[]> = {};
  for (const [refId, metricNames] of Object.entries(metricsByRefId)) {
    for (const metricName of metricNames) {
      (refsByMetric[metricName] ??= []).push(refId);
    }
  }
  return refsByMetric;
}
