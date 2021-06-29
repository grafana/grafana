import { BucketsConfiguration } from '../../../types';
import { defaultFilter } from './SettingsEditor/FiltersSettingsEditor/utils';
import { describeMetric } from '../../../utils';
import {
  ExtendedStatMetaType,
  ExtendedStats,
  MetricAggregation,
  Percentiles,
} from '../MetricAggregationsEditor/aggregations';
import { SelectableValue } from '@grafana/data';

export const bucketAggregationConfig: BucketsConfiguration = {
  terms: {
    label: 'Terms',
    requiresField: true,
    defaultSettings: {
      min_doc_count: '0',
      size: '10',
      order: 'desc',
      orderBy: '_term',
    },
  },
  filters: {
    label: 'Filters',
    requiresField: false,
    defaultSettings: {
      filters: [defaultFilter()],
    },
  },
  geohash_grid: {
    label: 'Geo Hash Grid',
    requiresField: true,
    defaultSettings: {
      precision: '3',
    },
  },
  date_histogram: {
    label: 'Date Histogram',
    requiresField: true,
    defaultSettings: {
      interval: 'auto',
      min_doc_count: '0',
      trimEdges: '0',
    },
  },
  histogram: {
    label: 'Histogram',
    requiresField: true,
    defaultSettings: {
      interval: '1000',
      min_doc_count: '0',
    },
  },
};

// TODO: Define better types for the following
type OrderByOption = SelectableValue<string>;
export const orderOptions: OrderByOption[] = [
  { label: 'Top', value: 'desc' },
  { label: 'Bottom', value: 'asc' },
];

export const sizeOptions = [
  { label: 'No limit', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '20', value: '20' },
];

export const orderByOptions = [
  { label: 'Term value', value: '_term' },
  { label: 'Doc Count', value: '_count' },
];

/**
 * This returns the valid options for each of the enabled extended stat
 */
function createOrderByOptionsForExtendedStats(metric: ExtendedStats): OrderByOption[] {
  if (!metric.meta) {
    return [];
  }
  const metaKeys = Object.keys(metric.meta) as ExtendedStatMetaType[];
  return metaKeys
    .filter((key) => metric.meta?.[key])
    .map((key) => {
      let method = key as string;
      // The bucket path for std_deviation_bounds.lower and std_deviation_bounds.upper
      // is accessed via std_lower and std_upper, respectively.
      if (key === 'std_deviation_bounds_lower') {
        method = 'std_lower';
      }
      if (key === 'std_deviation_bounds_upper') {
        method = 'std_upper';
      }
      return { label: `${describeMetric(metric)} (${method})`, value: `${metric.id}[${method}]` };
    });
}

/**
 * This returns the valid options for each of the percents listed in the percentile settings
 */
function createOrderByOptionsForPercentiles(metric: Percentiles): OrderByOption[] {
  if (!metric.settings?.percents) {
    return [];
  }
  return metric.settings.percents.map((percent) => {
    // The bucket path for percentile numbers is appended with a `.0` if the number is whole
    // otherwise you have to use the actual value.
    const percentString = /^\d+\.\d+/.test(`${percent}`) ? percent : `${percent}.0`;
    return { label: `${describeMetric(metric)} (${percent})`, value: `${metric.id}[${percentString}]` };
  });
}

const INCOMPATIBLE_ORDER_BY_AGGS = ['top_metrics'];

/**
 * This creates all the valid order by options based on the metrics
 */
export const createOrderByOptionsFromMetrics = (metrics: MetricAggregation[] = []): OrderByOption[] => {
  const metricOptions = metrics
    .filter((metric) => !INCOMPATIBLE_ORDER_BY_AGGS.includes(metric.type))
    .flatMap((metric) => {
      if (metric.type === 'extended_stats') {
        return createOrderByOptionsForExtendedStats(metric);
      } else if (metric.type === 'percentiles') {
        return createOrderByOptionsForPercentiles(metric);
      } else {
        return { label: describeMetric(metric), value: metric.id };
      }
    });
  return [...orderByOptions, ...metricOptions];
};
