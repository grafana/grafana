// TODO assess the use of this
// duplicates types from /Users/kristinadurivage/development/grafana/packages/grafana-api-clients/src/clients/rtkq/correlations/v0alpha1/endpoints.gen.ts

export type CorrelationTargetSpec = {
  [key: string]: unknown;
};
export type CorrelationTransformationSpec = {
  expression?: string;
  field?: string;
  mapValue?: string;
  type: 'regex' | 'logfmt';
};
export type CorrelationConfigSpec = {
  field: string;
  target: CorrelationTargetSpec;
  transformations?: CorrelationTransformationSpec[];
};
export type CorrelationDataSourceRef = {
  /** same as pluginId */
  group: string;
  /** same as grafana uid */
  name: string;
};
export type CorrelationCorrelationType = 'query' | 'external';
export type CorrelationSpec = {
  config: CorrelationConfigSpec;
  description?: string;
  label: string;
  source: CorrelationDataSourceRef;
  target?: CorrelationDataSourceRef;
  type: CorrelationCorrelationType;
};

export type Correlation = {
  apiVersion: string;
  kind: string;
  metadata: Record<string, unknown>;
  spec: CorrelationSpec;
};
