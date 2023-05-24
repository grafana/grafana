import { DataQuery, SelectableValue } from '@grafana/data';
import { DataSourceOptions, DataSourceSecureJsonData } from '@grafana/google-sdk';

import { MetricKind } from './query';

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

export interface Aggregation {
  crossSeriesReducer?: string;
  groupBys?: string[];
}

export interface CloudMonitoringOptions extends DataSourceOptions {
  gceDefaultProject?: string;
}

export interface CloudMonitoringSecureJsonData extends DataSourceSecureJsonData {}

export interface MetricDescriptor {
  valueType: string;
  metricKind: MetricKind;
  type: string;
  unit: string;
  service: string;
  serviceShortName: string;
  displayName: string;
  description: string;
}

export interface CustomMetaData {
  perSeriesAligner?: string;
  alignmentPeriod?: string;
}

export interface PostResponse {
  results: Record<string, any>;
}
