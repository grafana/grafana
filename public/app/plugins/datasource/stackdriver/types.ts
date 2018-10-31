export enum MetricFindQueryTypes {
  Services = 'services',
  MetricTypes = 'metricTypes',
  MetricLabels = 'metricLabels',
  ResourceLabels = 'resourceLabels',
  ResourceTypes = 'resourceTypes',
  Aggregations = 'aggregations',
  Alignerns = 'alignerns',
  AlignmentPeriods = 'alignmentPeriods',
}

export interface TemplateQueryComponentData {
  selectedQueryType: string;
  metricDescriptors: any[];
  selectedService: string;
  selectedMetricType: string;
  labels: string[];
  labelKey: string;
  metricTypes: Array<{ value: string; name: string }>;
  services: Array<{ value: string; name: string }>;
}
