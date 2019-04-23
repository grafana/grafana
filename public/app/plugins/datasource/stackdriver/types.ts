import { DataQuery } from '@grafana/ui/src/types';

export enum MetricFindQueryTypes {
  Services = 'services',
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
  metricDescriptors: any[];
  selectedService: string;
  selectedMetricType: string;
  labels: string[];
  labelKey: string;
  metricTypes: Array<{ value: string; name: string }>;
  services: Array<{ value: string; name: string }>;
}

export interface StackdriverQuery extends DataQuery {
  defaultProject?: string;
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

export interface AnnotationTarget {
  defaultProject: string;
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
