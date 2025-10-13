// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/types.ts
export type MetricsData = MetricData[];

export type MetricData = {
  value: string;
  type?: string | null;
  description?: string;
};

export type PromFilterOption = {
  value: string;
  description: string;
};

export interface HaystackDictionary {
  [needle: string]: MetricData;
}

export type UFuzzyInfo = {
  idx: number[];
  start: number[];
  chars: number[];
  terms: number[];
  interIns: number[];
  intraIns: number[];
  interLft2: number[];
  interRgt2: number[];
  interLft1: number[];
  interRgt1: number[];
  ranges: number[][];
};
