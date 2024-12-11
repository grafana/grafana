import { PromQuery } from '@grafana/prometheus';
import { VizPanelBuilder } from '@grafana/scenes';

export interface AutoQueryDef {
  variant: string;
  title: string;
  unit: string;
  queries: PromQuery[];
  vizBuilder: VizBuilder;
}

export interface AutoQueryInfo {
  preview: AutoQueryDef;
  main: AutoQueryDef;
  variants: AutoQueryDef[];
  breakdown: AutoQueryDef;
}

export type VizBuilder = () => VizPanelBuilder<{}, {}>;

export type AutoQueryContext = {
  metricParts: string[];
  isUtf8Metric: boolean;
  unit: string;
  suffix: string;
  unitSuffix?: string;
};
