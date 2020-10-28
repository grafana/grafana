import { isMetricAggregationWithField, MetricAggregation } from './components/MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from './components/MetricAggregationsEditor/utils';

export const describeMetric = (metric: MetricAggregation) => {
  if (!isMetricAggregationWithField(metric)) {
    return metricAggregationConfig[metric.type].label;
  }

  // TODO: Here it would be nice to have better descriptions for metrics
  return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};
