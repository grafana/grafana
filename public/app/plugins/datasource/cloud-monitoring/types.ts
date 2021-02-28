import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export enum AuthType {
  JWT = 'jwt',
  GCE = 'gce',
}

export const authTypes = [
  { value: 'Google JWT File', key: AuthType.JWT },
  { value: 'GCE Default Service Account', key: AuthType.GCE },
];

export enum MetricFindQueryTypes {
  Projects = 'projects',
  Services = 'services',
  DefaultProject = 'defaultProject',
  MetricTypes = 'metricTypes',
  LabelKeys = 'labelKeys',
  LabelValues = 'labelValues',
  ResourceTypes = 'resourceTypes',
  Aggregations = 'aggregations',
  Aligners = 'aligners',
  AlignmentPeriods = 'alignmentPeriods',
  Selectors = 'selectors',
  SLOServices = 'sloServices',
  SLO = 'slo',
}

export interface CloudMonitoringVariableQuery extends DataQuery {
  selectedQueryType: string;
  selectedService: string;
  selectedMetricType: string;
  selectedSLOService: string;
  labelKey: string;
  projects: SelectableValue[];
  sloServices: SelectableValue[];
  projectName: string;
}

export interface VariableQueryData {
  selectedQueryType: string;
  metricDescriptors: MetricDescriptor[];
  selectedService: string;
  selectedMetricType: string;
  selectedSLOService: string;
  labels: string[];
  labelKey: string;
  metricTypes: Array<{ value: string; name: string }>;
  services: SelectableValue[];
  projects: SelectableValue[];
  sloServices: SelectableValue[];
  projectName: string;
  loading: boolean;
}

export enum QueryType {
  METRICS = 'metrics',
  SLO = 'slo',
}

export enum EditorMode {
  Visual = 'visual',
  MQL = 'mql',
}

export const queryTypes = [
  { label: 'Metrics', value: QueryType.METRICS },
  { label: 'Service Level Objectives (SLO)', value: QueryType.SLO },
];

export interface MetricQuery {
  editorMode: EditorMode;
  projectName: string;
  unit?: string;
  metricType: string;
  crossSeriesReducer: string;
  alignmentPeriod?: string;
  perSeriesAligner?: string;
  groupBys?: string[];
  filters?: string[];
  aliasBy?: string;
  metricKind?: string;
  valueType?: string;
  view?: string;
  query: string;
}

export interface SLOQuery {
  projectName: string;
  alignmentPeriod?: string;
  perSeriesAligner?: string;
  aliasBy?: string;
  selectorName: string;
  serviceId: string;
  serviceName: string;
  sloId: string;
  sloName: string;
  goal?: number;
}

export interface CloudMonitoringQuery extends DataQuery {
  datasourceId?: number; // Should not be necessary anymore
  queryType: QueryType;
  metricQuery: MetricQuery;
  sloQuery?: SLOQuery;
  intervalMs: number;
  type: string;
}

export interface CloudMonitoringOptions extends DataSourceJsonData {
  defaultProject?: string;
  gceDefaultProject?: string;
  authenticationType?: string;
}

export interface AnnotationTarget {
  projectName: string;
  metricType: string;
  refId: string;
  filters: string[];
  metricKind: string;
  valueType: string;
  title: string;
  text: string;
}

export interface QueryMeta {
  alignmentPeriod: string;
  rawQuery: string;
  rawQueryString: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
  resourceTypes: string[];
}

export interface MetricDescriptor {
  valueType: string;
  metricKind: string;
  type: string;
  unit: string;
  service: string;
  serviceShortName: string;
  displayName: string;
  description: string;
}

export interface Segment {
  type: string;
  value: string;
}

export interface Filter {
  key: string;
  operator: string;
  value: string;
  condition?: string;
}
