import { isMetricAggregationWithField, MetricAggregation } from './components/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/MetricAggregationsEditor/utils';

export const describeMetric = (metric: MetricAggregation) => {
  if (!isMetricAggregationWithField(metric)) {
    return metricAggregationConfig[metric.type].label;
  }

  return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};
