// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/state/helpers.ts
import { t } from '@grafana/i18n';

import { PrometheusLanguageProviderInterface } from '../../../language_provider';

import { MetricData, MetricsData, PromFilterOption } from './types';

// Constants
const HISTOGRAM_TYPES = ['histogram', 'summary'] as const;
const OLD_HISTOGRAM_PATTERN = /^\w+_bucket$|^\w+_bucket{.*}$/;
const HISTOGRAM_TYPE = 'histogram';
const NATIVE_HISTOGRAM_TYPE = 'native histogram';

/**
 * Builds the metric data object with type and description
 * @param metric - The metric name
 * @param languageProvider - The Prometheus language provider interface
 * @returns MetricData object with value, type, and description
 */
export const generateMetricData = (
  metric: string,
  languageProvider: PrometheusLanguageProviderInterface
): MetricData => {
  const metadata = languageProvider.retrieveMetricsMetadata();

  let type = metadata[metric]?.type;
  const description = metadata[metric]?.help;

  HISTOGRAM_TYPES.forEach((t) => {
    if (description?.toLowerCase().includes(t) && type !== t) {
      type = type ? `${type} (${t})` : t;
    }
  });

  const oldHistogramMatch = metric.match(OLD_HISTOGRAM_PATTERN);

  if (type === HISTOGRAM_TYPE && !oldHistogramMatch) {
    type = NATIVE_HISTOGRAM_TYPE;
  }

  return {
    value: metric,
    type: type,
    description: description,
  };
};

export function calculatePageList(metricsData: MetricsData, resultsPerPage: number): number[] {
  if (!Array.isArray(metricsData) || metricsData.length === 0) {
    return [];
  }

  if (resultsPerPage <= 0) {
    return [1];
  }

  const totalPages = Math.ceil(metricsData.length / resultsPerPage);
  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export const getPromTypes: () => PromFilterOption[] = () => [
  {
    value: 'counter',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-counter', 'Counter'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-counter',
      'A cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart.'
    ),
  },
  {
    value: 'gauge',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-gauge', 'Gauge'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-gauge',
      'A metric that represents a single numerical value that can arbitrarily go up and down.'
    ),
  },
  {
    value: 'histogram',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-histogram', 'Histogram'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-histogram',
      'A histogram samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.'
    ),
  },
  {
    value: 'native histogram',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-native-histogram', 'Native histogram'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-native-histogram',
      'Native histograms are different from classic Prometheus histograms in a number of ways: Native histogram bucket boundaries are calculated by a formula that depends on the scale (resolution) of the native histogram, and are not user defined.'
    ),
  },
  {
    value: 'summary',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-summary', 'Summary'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-summary',
      'A summary samples observations (usually things like request durations and response sizes) and can calculate configurable quantiles over a sliding time window.'
    ),
  },
  {
    value: 'unknown',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-unknown', 'Unknown'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-unknown',
      'These metrics have been given the type unknown in the metadata.'
    ),
  },
  {
    value: 'no type',
    label: t('grafana-prometheus.querybuilder.get-prom-types.label-no-type', 'No type'),
    description: t(
      'grafana-prometheus.querybuilder.get-prom-types.description-no-type',
      'These metrics have no defined type in the metadata.'
    ),
  },
];

export const getPlaceholders = () => ({
  browse: t('grafana-prometheus.querybuilder.get-placeholders.browse', 'Search metrics by name'),
  filterType: t('grafana-prometheus.querybuilder.get-placeholders.type', 'Filter by type'),
});
