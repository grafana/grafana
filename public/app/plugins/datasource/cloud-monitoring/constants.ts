import { GoogleAuthType } from '@grafana/google-sdk';

import { MetricKind, QueryType, ValueTypes } from './types';

// not super excited about using uneven numbers, but this makes it align perfectly with rows that has two fields
export const INPUT_WIDTH = 71;
export const LABEL_WIDTH = 19;
export const INNER_LABEL_WIDTH = 14;
export const SELECT_WIDTH = 28;
export const AUTH_TYPES = [
  { value: 'Google JWT File', key: GoogleAuthType.JWT },
  { value: 'GCE Default Service Account', key: GoogleAuthType.GCE },
];

export const ALIGNMENTS = [
  {
    text: 'none',
    value: 'ALIGN_NONE',
    valueTypes: [
      ValueTypes.INT64,
      ValueTypes.DOUBLE,
      ValueTypes.MONEY,
      ValueTypes.DISTRIBUTION,
      ValueTypes.STRING,
      ValueTypes.VALUE_TYPE_UNSPECIFIED,
      ValueTypes.BOOL,
    ],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'delta',
    value: 'ALIGN_DELTA',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.CUMULATIVE, MetricKind.DELTA],
  },
  {
    text: 'rate',
    value: 'ALIGN_RATE',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.CUMULATIVE, MetricKind.DELTA],
  },
  {
    text: 'interpolate',
    value: 'ALIGN_INTERPOLATE',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'next older',
    value: 'ALIGN_NEXT_OLDER',
    valueTypes: [
      ValueTypes.INT64,
      ValueTypes.DOUBLE,
      ValueTypes.MONEY,
      ValueTypes.DISTRIBUTION,
      ValueTypes.STRING,
      ValueTypes.VALUE_TYPE_UNSPECIFIED,
      ValueTypes.BOOL,
    ],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'min',
    value: 'ALIGN_MIN',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'max',
    value: 'ALIGN_MAX',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'mean',
    value: 'ALIGN_MEAN',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'count',
    value: 'ALIGN_COUNT',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'sum',
    value: 'ALIGN_SUM',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'stddev',
    value: 'ALIGN_STDDEV',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'count true',
    value: 'ALIGN_COUNT_TRUE',
    valueTypes: [ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'count false',
    value: 'ALIGN_COUNT_FALSE',
    valueTypes: [ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'fraction true',
    value: 'ALIGN_FRACTION_TRUE',
    valueTypes: [ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE],
  },
  {
    text: 'percentile 99',
    value: 'ALIGN_PERCENTILE_99',
    valueTypes: [ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'percentile 95',
    value: 'ALIGN_PERCENTILE_95',
    valueTypes: [ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'percentile 50',
    value: 'ALIGN_PERCENTILE_50',
    valueTypes: [ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'percentile 05',
    value: 'ALIGN_PERCENTILE_05',
    valueTypes: [ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'percent change',
    value: 'ALIGN_PERCENT_CHANGE',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
];

export const AGGREGATIONS = [
  {
    text: 'none',
    value: 'REDUCE_NONE',
    valueTypes: [
      ValueTypes.INT64,
      ValueTypes.DOUBLE,
      ValueTypes.MONEY,
      ValueTypes.DISTRIBUTION,
      ValueTypes.BOOL,
      ValueTypes.STRING,
    ],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE, MetricKind.METRIC_KIND_UNSPECIFIED],
  },
  {
    text: 'mean',
    value: 'REDUCE_MEAN',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
  {
    text: 'min',
    value: 'REDUCE_MIN',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE, MetricKind.METRIC_KIND_UNSPECIFIED],
  },
  {
    text: 'max',
    value: 'REDUCE_MAX',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE, MetricKind.METRIC_KIND_UNSPECIFIED],
  },
  {
    text: 'sum',
    value: 'REDUCE_SUM',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE, MetricKind.METRIC_KIND_UNSPECIFIED],
  },
  {
    text: 'std. dev.',
    value: 'REDUCE_STDDEV',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE, MetricKind.METRIC_KIND_UNSPECIFIED],
  },
  {
    text: 'count',
    value: 'REDUCE_COUNT',
    valueTypes: [
      ValueTypes.INT64,
      ValueTypes.DOUBLE,
      ValueTypes.MONEY,
      ValueTypes.DISTRIBUTION,
      ValueTypes.BOOL,
      ValueTypes.STRING,
    ],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
  {
    text: 'count true',
    value: 'REDUCE_COUNT_TRUE',
    valueTypes: [ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: 'count false',
    value: 'REDUCE_COUNT_FALSE',
    valueTypes: [ValueTypes.BOOL],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA],
  },
  {
    text: '99th percentile',
    value: 'REDUCE_PERCENTILE_99',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
  {
    text: '95th percentile',
    value: 'REDUCE_PERCENTILE_95',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
  {
    text: '50th percentile',
    value: 'REDUCE_PERCENTILE_50',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
  {
    text: '5th percentile',
    value: 'REDUCE_PERCENTILE_05',
    valueTypes: [ValueTypes.INT64, ValueTypes.DOUBLE, ValueTypes.MONEY, ValueTypes.DISTRIBUTION],
    metricKinds: [MetricKind.GAUGE, MetricKind.DELTA, MetricKind.CUMULATIVE],
  },
];

export type periodOption = {
  text: string;
  value: string;
  hidden?: boolean;
};

export const ALIGNMENT_PERIODS: periodOption[] = [
  { text: 'grafana auto', value: 'grafana-auto' },
  { text: 'stackdriver auto', value: 'stackdriver-auto', hidden: true },
  { text: 'cloud monitoring auto', value: 'cloud-monitoring-auto' },
  { text: '1m', value: '+60s' },
  { text: '2m', value: '+120s' },
  { text: '5m', value: '+300s' },
  { text: '10m', value: '+600s' },
  { text: '30m', value: '+1800s' },
  { text: '1h', value: '+3600s' },
  { text: '3h', value: '+7200s' },
  { text: '6h', value: '+21600s' },
  { text: '1d', value: '+86400s' },
  { text: '3d', value: '+259200s' },
  { text: '1w', value: '+604800s' },
];

export const GRAPH_PERIODS: periodOption[] = [
  { text: 'auto', value: 'auto' },
  { text: '1m', value: '1m' },
  { text: '2m', value: '2m' },
  { text: '5m', value: '5m' },
  { text: '10m', value: '10m' },
  { text: '30m', value: '30m' },
  { text: '1h', value: '1h' },
  { text: '3h', value: '3h' },
  { text: '6h', value: '6h' },
  { text: '1d', value: '1d' },
  { text: '3d', value: '3d' },
  { text: '1w', value: '1w' },
];

// Usable units: ns, us, ms, s, m, h
// ref. https://cloud.google.com/stackdriver/docs/solutions/slo-monitoring/api/timeseries-selectors#tss-names-args
export const LOOKBACK_PERIODS: periodOption[] = [
  { text: '1m', value: '1m' },
  { text: '2m', value: '2m' },
  { text: '5m', value: '5m' },
  { text: '10m', value: '10m' },
  { text: '30m', value: '30m' },
  { text: '1h', value: '1h' },
  { text: '3h', value: '3h' },
  { text: '6h', value: '6h' },
  { text: '24h', value: '24h' },
  { text: '72h', value: '72h' },
];

export const SYSTEM_LABELS = [
  'metadata.system_labels.cloud_account',
  'metadata.system_labels.name',
  'metadata.system_labels.region',
  'metadata.system_labels.state',
  'metadata.system_labels.instance_group',
  'metadata.system_labels.node_name',
  'metadata.system_labels.service_name',
  'metadata.system_labels.top_level_controller_type',
  'metadata.system_labels.top_level_controller_name',
  'metadata.system_labels.container_image',
];

export const SLO_BURN_RATE_SELECTOR_NAME = 'select_slo_burn_rate';

export const SELECTORS = [
  { label: 'SLI Value', value: 'select_slo_health' },
  { label: 'SLO Compliance', value: 'select_slo_compliance' },
  { label: 'SLO Error Budget Remaining', value: 'select_slo_budget_fraction' },
  { label: 'SLO Burn Rate', value: SLO_BURN_RATE_SELECTOR_NAME },
];

export const QUERY_TYPES = [
  { label: 'Builder', value: QueryType.TIME_SERIES_LIST },
  { label: 'MQL', value: QueryType.TIME_SERIES_QUERY },
  { label: 'Service Level Objectives (SLO)', value: QueryType.SLO },
];
