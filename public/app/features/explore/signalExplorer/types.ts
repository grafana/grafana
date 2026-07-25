export type MetricType = 'counter' | 'gauge' | 'histogram' | 'native histogram' | 'summary' | 'unknown';

// Labels and label values are not part of this shape: they are fetched per expanded metric and
// arrive from `useMetricDetail`/`useLabelValues` as plain `string[]`, so a field here would only ever
// read `undefined`.
export interface MetricRow {
  name: string;
  type: MetricType;
  help?: string;
  unit?: string;
}
