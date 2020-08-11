import _ from 'lodash';

export const metricAggTypes = [
  { text: 'Count', value: 'count', requiresField: false },
  {
    text: 'Average',
    value: 'avg',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  {
    text: 'Sum',
    value: 'sum',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  {
    text: 'Max',
    value: 'max',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  {
    text: 'Min',
    value: 'min',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  {
    text: 'Extended Stats',
    value: 'extended_stats',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
  },
  {
    text: 'Percentiles',
    value: 'percentiles',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
  },
  {
    text: 'Unique Count',
    value: 'cardinality',
    requiresField: true,
    supportsMissing: true,
  },
  {
    text: 'Moving Average',
    value: 'moving_avg',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  {
    text: 'Derivative',
    value: 'derivative',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  {
    text: 'Cumulative Sum',
    value: 'cumulative_sum',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  {
    text: 'Bucket Script',
    value: 'bucket_script',
    requiresField: false,
    isPipelineAgg: true,
    supportsMultipleBucketPaths: true,
    minVersion: 2,
  },
  { text: 'Raw Document (legacy)', value: 'raw_document', requiresField: false },
  { text: 'Raw Data', value: 'raw_data', requiresField: false },
  { text: 'Logs', value: 'logs', requiresField: false },
];

export const bucketAggTypes = [
  { text: 'Terms', value: 'terms', requiresField: true },
  { text: 'Filters', value: 'filters' },
  { text: 'Geo Hash Grid', value: 'geohash_grid', requiresField: true },
  { text: 'Date Histogram', value: 'date_histogram', requiresField: true },
  { text: 'Histogram', value: 'histogram', requiresField: true },
];

export const orderByOptions = [
  { text: 'Doc Count', value: '_count' },
  { text: 'Term value', value: '_term' },
];

export const orderOptions = [
  { text: 'Top', value: 'desc' },
  { text: 'Bottom', value: 'asc' },
];

export const sizeOptions = [
  { text: 'No limit', value: '0' },
  { text: '1', value: '1' },
  { text: '2', value: '2' },
  { text: '3', value: '3' },
  { text: '5', value: '5' },
  { text: '10', value: '10' },
  { text: '15', value: '15' },
  { text: '20', value: '20' },
];

export const extendedStats = [
  { text: 'Avg', value: 'avg' },
  { text: 'Min', value: 'min' },
  { text: 'Max', value: 'max' },
  { text: 'Sum', value: 'sum' },
  { text: 'Count', value: 'count' },
  { text: 'Std Dev', value: 'std_deviation' },
  { text: 'Std Dev Upper', value: 'std_deviation_bounds_upper' },
  { text: 'Std Dev Lower', value: 'std_deviation_bounds_lower' },
];

export const intervalOptions = [
  { text: 'auto', value: 'auto' },
  { text: '10s', value: '10s' },
  { text: '1m', value: '1m' },
  { text: '5m', value: '5m' },
  { text: '10m', value: '10m' },
  { text: '20m', value: '20m' },
  { text: '1h', value: '1h' },
  { text: '1d', value: '1d' },
];

export const movingAvgModelOptions = [
  { text: 'Simple', value: 'simple' },
  { text: 'Linear', value: 'linear' },
  { text: 'Exponentially Weighted', value: 'ewma' },
  { text: 'Holt Linear', value: 'holt' },
  { text: 'Holt Winters', value: 'holt_winters' },
];

export const pipelineOptions: any = {
  moving_avg: [
    { text: 'window', default: 5 },
    { text: 'model', default: 'simple' },
    { text: 'predict', default: undefined },
    { text: 'minimize', default: false },
  ],
  derivative: [{ text: 'unit', default: undefined }],
  cumulative_sum: [{ text: 'format', default: undefined }],
  bucket_script: [],
};

export const movingAvgModelSettings: any = {
  simple: [],
  linear: [],
  ewma: [{ text: 'Alpha', value: 'alpha', default: undefined }],
  holt: [
    { text: 'Alpha', value: 'alpha', default: undefined },
    { text: 'Beta', value: 'beta', default: undefined },
  ],
  holt_winters: [
    { text: 'Alpha', value: 'alpha', default: undefined },
    { text: 'Beta', value: 'beta', default: undefined },
    { text: 'Gamma', value: 'gamma', default: undefined },
    { text: 'Period', value: 'period', default: undefined },
    { text: 'Pad', value: 'pad', default: undefined, isCheckbox: true },
  ],
};

export function getMetricAggTypes(esVersion: any) {
  return _.filter(metricAggTypes, f => {
    if (f.minVersion) {
      return f.minVersion <= esVersion;
    } else {
      return true;
    }
  });
}

export function getPipelineOptions(metric: any) {
  if (!isPipelineAgg(metric.type)) {
    return [];
  }

  return pipelineOptions[metric.type];
}

export function isPipelineAgg(metricType: any) {
  if (metricType) {
    const po = pipelineOptions[metricType];
    return po !== null && po !== undefined;
  }

  return false;
}

export function isPipelineAggWithMultipleBucketPaths(metricType: any) {
  if (metricType) {
    return metricAggTypes.find(t => t.value === metricType && t.supportsMultipleBucketPaths) !== undefined;
  }

  return false;
}

export function getPipelineAggOptions(targets: any) {
  const result: any[] = [];
  _.each(targets.metrics, metric => {
    if (!isPipelineAgg(metric.type)) {
      result.push({ text: describeMetric(metric), value: metric.id });
    }
  });

  return result;
}

export function getMovingAvgSettings(model: any, filtered: boolean) {
  const filteredResult: any[] = [];
  if (filtered) {
    _.each(movingAvgModelSettings[model], setting => {
      if (!setting.isCheckbox) {
        filteredResult.push(setting);
      }
    });
    return filteredResult;
  }
  return movingAvgModelSettings[model];
}

export function getOrderByOptions(target: any) {
  const metricRefs: any[] = [];
  _.each(target.metrics, metric => {
    if (metric.type !== 'count') {
      metricRefs.push({ text: describeMetric(metric), value: metric.id });
    }
  });

  return orderByOptions.concat(metricRefs);
}

export function describeOrder(order: string) {
  const def: any = _.find(orderOptions, { value: order });
  return def.text;
}

export function describeMetric(metric: { type: string; field: string }) {
  const def: any = _.find(metricAggTypes, { value: metric.type });
  if (!def.requiresField && !isPipelineAgg(metric.type)) {
    return def.text;
  }
  return def.text + ' ' + metric.field;
}

export function describeOrderBy(orderBy: any, target: any) {
  const def: any = _.find(orderByOptions, { value: orderBy });
  if (def) {
    return def.text;
  }
  const metric: any = _.find(target.metrics, { id: orderBy });
  if (metric) {
    return describeMetric(metric);
  } else {
    return 'metric not found';
  }
}

export function defaultMetricAgg() {
  return { type: 'count', id: '1' };
}

export function defaultBucketAgg() {
  return { type: 'date_histogram', id: '2', settings: { interval: 'auto' } };
}

export const findMetricById = (metrics: any[], id: any) => {
  return _.find(metrics, { id: id });
};

export function hasMetricOfType(target: any, type: string): boolean {
  return target && target.metrics && target.metrics.some((m: any) => m.type === type);
}
