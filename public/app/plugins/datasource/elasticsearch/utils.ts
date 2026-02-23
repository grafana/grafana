import { gte, SemVer } from 'semver';

import { isMetricAggregationWithField } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { ElasticsearchDataQuery, MetricAggregation, MetricAggregationWithInlineScript } from './dataquery.gen';

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
export const removeEmpty = <T extends {}>(obj: T): Partial<T> =>
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
    if (typeof value === 'string' && value.length === 0) {
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

export const isSupportedVersion = (version: SemVer): boolean => {
  if (gte(version, '7.16.0')) {
    return true;
  }

  return false;
};

export const unsupportedVersionMessage =
  'Support for Elasticsearch versions after their end-of-life (currently versions < 7.16) was removed. Using unsupported version of Elasticsearch may lead to unexpected and incorrect results.';

// To be considered a time series query, the last bucked aggregation must be a Date Histogram
export const isTimeSeriesQuery = (query: ElasticsearchDataQuery): boolean => {
  return query?.bucketAggs?.slice(-1)[0]?.type === 'date_histogram';
};

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * There are 6 capture groups that replace will return
 * \$(\w+)                                    $var1
 * \[\[(\w+?)(?::(\w+))?\]\]                  [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}   ${var3} or ${var3.fieldPath} or ${var3:fmt3} (or ${var3.fieldPath:fmt3} but that is not a separate capture group)
 */
export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

// Copyright (c) 2014, Hugh Kennedy
// Based on code from https://github.com/hughsk/flat/blob/master/index.js
//
export function flattenObject(
  target: Record<string, unknown>,
  opts?: { delimiter?: string; maxDepth?: number; safe?: boolean }
): Record<string, unknown> {
  opts = opts || {};

  const delimiter = opts.delimiter || '.';
  let maxDepth = opts.maxDepth || 3;
  let currentDepth = 1;
  const output: Record<string, unknown> = {};

  function step(object: Record<string, unknown>, prev: string | null) {
    Object.keys(object).forEach((key) => {
      const value = object[key];
      const isarray = opts?.safe && Array.isArray(value);
      const type = Object.prototype.toString.call(value);
      const isobject = type === '[object Object]';

      const newKey = prev ? prev + delimiter + key : key;

      if (!opts?.maxDepth) {
        maxDepth = currentDepth + 1;
      }

      if (!isarray && isobject && value && Object.keys(value).length && currentDepth < maxDepth) {
        ++currentDepth;
        return step({ ...value }, newKey);
      }

      output[newKey] = value;
    });
  }

  step(target, null);

  return output;
}
