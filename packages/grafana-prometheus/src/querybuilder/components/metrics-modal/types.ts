// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/types.ts
export type MetricsData = MetricData[];

export type MetricData = {
  value: string;
  type?: string | null;
  description?: string;
};

export type PromFilterOption = {
  value: string;
  label: string;
  description: string;
};

export interface HaystackDictionary {
  [needle: string]: MetricData;
}
