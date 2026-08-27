export type MetricType = 'counter' | 'gauge' | 'histogram' | 'native histogram' | 'summary' | 'unknown';

// Labels and label values are not part of this shape: they are fetched per expanded metric and
// arrive from `useMetricDetail`/`useLabelValues` as plain `string[]`, so a field here would only ever
// read `undefined`.
export interface MetricInfo {
  name: string;
  type: MetricType;
  help?: string;
  unit?: string;
}

/**
 * The metric the sidebar's detail panel is showing. Carried by value so the panel costs no request,
 * and tagged with the card it came from, whose catalog is the only one it is true of.
 */
export interface MetricSelection {
  refId: string;
  dsKey: string;
  metric: MetricInfo;
}
