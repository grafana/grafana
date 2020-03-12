import { DataQuery, DataSourceJsonData } from '@grafana/data';

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
}

export interface VariableQueryData {
  selectedQueryType: string;
  metricDescriptors: MetricDescriptor[];
  selectedService: string;
  selectedMetricType: string;
  labels: string[];
  labelKey: string;
  metricTypes: Array<{ value: string; name: string }>;
  services: Array<{ value: string; name: string }>;
  projects: Array<{ value: string; name: string }>;
  projectName: string;
}

export interface StackdriverQuery extends DataQuery {
  projectName: string;
  unit?: string;
  metricType: string;
  service?: string;
  refId: string;
  crossSeriesReducer: string;
  alignmentPeriod?: string;
  perSeriesAligner: string;
  groupBys?: string[];
  filters?: string[];
  aliasBy?: string;
  metricKind: string;
  valueType: string;
  datasourceId?: number;
  view?: string;
}

export interface StackdriverOptions extends DataSourceJsonData {
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
  condition: string;
}
