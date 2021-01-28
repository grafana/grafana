import {
  isMetricAggregationWithField,
  MetricAggregation,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';

export const describeMetric = (metric: MetricAggregation) => {
  if (!isMetricAggregationWithField(metric)) {
    return metricAggregationConfig[metric.type].label;
  }

  // TODO: field might be undefined
  return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};

/**
 * Utility function to clean up aggregations settings objects.
 * It removes nullish values and empty strings, array and objects
 * recursing over nested objects (not arrays).
 * @param obj
 */
export const removeEmpty = <T>(obj: T): Partial<T> =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    // Removing nullish values (null & undefined)
    if (value == null) {
      return { ...acc };
    }

    // Removing empty arrays (This won't recurse the array)
    if (Array.isArray(value) && value.length === 0) {
      return { ...acc };
    }

    // Removing empty strings
    if (value?.length === 0) {
      return { ...acc };
    }

    // Recursing over nested objects
    if (!Array.isArray(value) && typeof value === 'object') {
      const cleanObj = removeEmpty(value);

      if (Object.keys(cleanObj).length === 0) {
        return { ...acc };
      }

      return { ...acc, [key]: cleanObj };
    }

    return {
      ...acc,
      [key]: value,
    };
  }, {});

/**
 *  This function converts an order by string to the correct metric id For example,
 *  if the user uses the standard deviation extended stat for the order by,
 *  the value would be "1[std_deviation]" and this would return "1"
 */
export const convertOrderByToMetricId = (orderBy: string): string | undefined => {
  const metricIdMatches = orderBy.match(/^(\d+)/);
  return metricIdMatches ? metricIdMatches[1] : void 0;
};
