import { valid, gte } from 'semver';

import {
  isMetricAggregationWithField,
  MetricAggregation,
  MetricAggregationWithInlineScript,
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

/** Gets the actual script value for metrics that support inline scripts.
 *
 *  This is needed because the `script` is a bit polymorphic.
 *  when creating a query with Grafana < 7.4 it was stored as:
 * ```json
 * {
 *    "settings": {
 *      "script": {
 *        "inline": "value"
 *      }
 *    }
 * }
 * ```
 *
 * while from 7.4 it's stored as
 * ```json
 * {
 *    "settings": {
 *      "script": "value"
 *    }
 * }
 * ```
 *
 * This allows us to access both formats and support both queries created before 7.4 and after.
 */
export const getScriptValue = (metric: MetricAggregationWithInlineScript) =>
  (typeof metric.settings?.script === 'object' ? metric.settings?.script?.inline : metric.settings?.script) || '';

/**
 * Coerces the version to a valid semver string.
 * It takes care of also converting from the legacy format (numeric) to the new one.
 * @param version
 */
export const coerceESVersion = (version: string | number | undefined): string => {
  if (typeof version === 'string') {
    return valid(version) || '5.0.0';
  }

  switch (version) {
    case 2:
      return '2.0.0';
    case 56:
      return '5.6.0';
    case 60:
      return '6.0.0';
    case 70:
      return '7.0.0';
    case 5:
    default:
      return '5.0.0';
  }
};

export const isSupportedVersion = (version: string): boolean => {
  if (gte(version, '7.10.0')) {
    return true;
  }

  return false;
};
