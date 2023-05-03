import { DataQuery, SelectableValue } from '@grafana/data';
import { DataSourceOptions, DataSourceSecureJsonData } from '@grafana/google-sdk';

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

export interface Aggregation {
  crossSeriesReducer?: string;
  groupBys?: string[];
}

export enum QueryType {
  TIME_SERIES_LIST = 'timeSeriesList',
  TIME_SERIES_QUERY = 'timeSeriesQuery',
  SLO = 'slo',
  ANNOTATION = 'annotation',
}

export enum PreprocessorType {
  None = 'none',
  Rate = 'rate',
  Delta = 'delta',
}

export enum MetricKind {
  METRIC_KIND_UNSPECIFIED = 'METRIC_KIND_UNSPECIFIED',
  GAUGE = 'GAUGE',
  DELTA = 'DELTA',
  CUMULATIVE = 'CUMULATIVE',
}

export enum ValueTypes {
  VALUE_TYPE_UNSPECIFIED = 'VALUE_TYPE_UNSPECIFIED',
  BOOL = 'BOOL',
  INT64 = 'INT64',
  DOUBLE = 'DOUBLE',
  STRING = 'STRING',
  DISTRIBUTION = 'DISTRIBUTION',
  MONEY = 'MONEY',
}

export enum AlignmentTypes {
  ALIGN_DELTA = 'ALIGN_DELTA',
  ALIGN_RATE = 'ALIGN_RATE',
  ALIGN_INTERPOLATE = 'ALIGN_INTERPOLATE',
  ALIGN_NEXT_OLDER = 'ALIGN_NEXT_OLDER',
  ALIGN_MIN = 'ALIGN_MIN',
  ALIGN_MAX = 'ALIGN_MAX',
  ALIGN_MEAN = 'ALIGN_MEAN',
  ALIGN_COUNT = 'ALIGN_COUNT',
  ALIGN_SUM = 'ALIGN_SUM',
  ALIGN_STDDEV = 'ALIGN_STDDEV',
  ALIGN_COUNT_TRUE = 'ALIGN_COUNT_TRUE',
  ALIGN_COUNT_FALSE = 'ALIGN_COUNT_FALSE',
  ALIGN_FRACTION_TRUE = 'ALIGN_FRACTION_TRUE',
  ALIGN_PERCENTILE_99 = 'ALIGN_PERCENTILE_99',
  ALIGN_PERCENTILE_95 = 'ALIGN_PERCENTILE_95',
  ALIGN_PERCENTILE_50 = 'ALIGN_PERCENTILE_50',
  ALIGN_PERCENTILE_05 = 'ALIGN_PERCENTILE_05',
  ALIGN_PERCENT_CHANGE = 'ALIGN_PERCENT_CHANGE',
  ALIGN_NONE = 'ALIGN_NONE',
}

// deprecated: use TimeSeriesList instead
// left here for migration purposes
export interface MetricQuery {
  projectName: string;
  perSeriesAligner?: string;
  alignmentPeriod?: string;
  aliasBy?: string;
  editorMode: string;
  metricType: string;
  crossSeriesReducer: string;
  groupBys?: string[];
  filters?: string[];
  metricKind?: MetricKind;
  valueType?: string;
  view?: string;
  query: string;
  preprocessor?: PreprocessorType;
  // To disable the graphPeriod, it should explictly be set to 'disabled'
  graphPeriod?: 'disabled' | string;
}

export interface TimeSeriesList {
  projectName: string;
  crossSeriesReducer: string;
  alignmentPeriod?: string;
  perSeriesAligner?: string;
  groupBys?: string[];
  filters?: string[];
  view?: string;
  secondaryCrossSeriesReducer?: string;
  secondaryAlignmentPeriod?: string;
  secondaryPerSeriesAligner?: string;
  secondaryGroupBys?: string[];
  // preprocessor is not part of the API, but is used to store the preprocessor
  // and not affect the UI for the rest of parameters
  preprocessor?: PreprocessorType;
}

export interface TimeSeriesQuery {
  projectName: string;
  query: string;
  // To disable the graphPeriod, it should explictly be set to 'disabled'
  graphPeriod?: 'disabled' | string;
}

export interface AnnotationQuery extends TimeSeriesList {
  title?: string;
  text?: string;
}

export interface SLOQuery {
  projectName: string;
  perSeriesAligner?: string;
  alignmentPeriod?: string;
  selectorName: string;
  serviceId: string;
  serviceName: string;
  sloId: string;
  sloName: string;
  goal?: number;
  lookbackPeriod?: string;
}

export interface CloudMonitoringQuery extends DataQuery {
  aliasBy?: string;
  datasourceId?: number; // Should not be necessary anymore
  queryType: QueryType;
  timeSeriesList?: TimeSeriesList | AnnotationQuery;
  timeSeriesQuery?: TimeSeriesQuery;
  sloQuery?: SLOQuery;
  intervalMs: number;
}

export interface CloudMonitoringOptions extends DataSourceOptions {
  gceDefaultProject?: string;
}

export interface CloudMonitoringSecureJsonData extends DataSourceSecureJsonData {}

export interface LegacyCloudMonitoringAnnotationQuery {
  projectName: string;
  metricType: string;
  refId: string;
  filters: string[];
  metricKind: MetricKind;
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
  metricKind: MetricKind;
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

export interface CustomMetaData {
  perSeriesAligner?: string;
  alignmentPeriod?: string;
}

export interface PostResponse {
  results: Record<string, any>;
}
