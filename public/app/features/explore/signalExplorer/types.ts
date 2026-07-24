export type MetricType = 'counter' | 'gauge' | 'histogram' | 'native histogram' | 'summary' | 'unknown';

export interface MetricLabel {
  name: string;
  values?: string[]; // populated lazily on deeper expand
}

export interface MetricRow {
  name: string;
  type: MetricType;
  help?: string;
  unit?: string;
  labels?: MetricLabel[]; // label keys populated lazily on expand
}
