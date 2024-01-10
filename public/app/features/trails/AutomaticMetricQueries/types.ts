import { VizPanelBuilder } from '@grafana/scenes';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

export interface AutoQueryDef {
  variant: string;
  title: string;
  unit: string;
  queries: PromQuery[];
  vizBuilder: (def: AutoQueryDef) => VizPanelBuilder<{}, {}>;
}

export interface AutoQueryInfo {
  preview: AutoQueryDef;
  main: AutoQueryDef;
  variants: AutoQueryDef[];
  breakdown: AutoQueryDef;
}
