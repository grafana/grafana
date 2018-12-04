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
