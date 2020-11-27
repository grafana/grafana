import { isMetricAggregationWithField, MetricAggregation } from './components/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/MetricAggregationsEditor/utils';

export const describeMetric = (metric: MetricAggregation) => {
  if (!isMetricAggregationWithField(metric)) {
    return metricAggregationConfig[metric.type].label;
  }

  // TODO: field might be undefined
  return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};
