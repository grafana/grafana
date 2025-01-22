// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_utils.ts
import { invert } from 'lodash';
import { Token } from 'prismjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  DataQuery,
  dateMath,
  DateTime,
  incrRoundDn,
  TimeRange,
} from '@grafana/data';

import { addLabelToQuery } from './add_label_to_query';
import { SUGGESTIONS_LIMIT } from './language_provider';
import { PROMETHEUS_QUERY_BUILDER_MAX_RESULTS } from './querybuilder/components/MetricSelect';
import { PrometheusCacheLevel, PromMetricsMetadata, PromMetricsMetadataItem, RecordingRuleIdentifier } from './types';

export const processHistogramMetrics = (metrics: string[]) => {
  const resultSet: Set<string> = new Set();
  const regexp = new RegExp('_bucket($|:)');
  for (let index = 0; index < metrics.length; index++) {
    const metric = metrics[index];
    const isHistogramValue = regexp.test(metric);
    if (isHistogramValue) {
      resultSet.add(metric);
    }
  }
  return [...resultSet];
};

export function processLabels(labels: Array<{ [key: string]: string }>, withName = false) {
  // For processing we are going to use sets as they have significantly better performance than arrays
  // After we process labels, we will convert sets to arrays and return object with label values in arrays
  const valueSet: { [key: string]: Set<string> } = {};
  labels.forEach((label) => {
    const { __name__, ...rest } = label;
    if (withName) {
      valueSet['__name__'] = valueSet['__name__'] || new Set();
      if (!valueSet['__name__'].has(__name__)) {
        valueSet['__name__'].add(__name__);
      }
    }

    Object.keys(rest).forEach((key) => {
      if (!valueSet[key]) {
        valueSet[key] = new Set();
      }
      if (!valueSet[key].has(rest[key])) {
        valueSet[key].add(rest[key]);
      }
    });
  });

  // valueArray that we are going to return in the object
  const valueArray: { [key: string]: string[] } = {};
  limitSuggestions(Object.keys(valueSet)).forEach((key) => {
    valueArray[key] = limitSuggestions(Array.from(valueSet[key]));
  });

  return { values: valueArray, keys: Object.keys(valueArray) };
}

// const cleanSelectorRegexp = /\{(\w+="[^"\n]*?")(,\w+="[^"\n]*?")*\}/;
export const selectorRegexp = /\{[^}]*?(\}|$)/;

// This will capture 4 groups. Example label filter => {instance="10.4.11.4:9003"}
// 1. label:    instance
// 2. operator: =
// 3. value:    "10.4.11.4:9003"
// 4. comma:    if there is a comma it will give ,
// 5. space:    if there is a space after comma it will give the whole space
// comma and space is useful for addLabelsToExpression function
export const labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")(,)?(\s*)?/g;

export function parseSelector(query: string, cursorOffset = 1): { labelKeys: string[]; selector: string } {
  if (!query.match(selectorRegexp)) {
    // Special matcher for metrics
    if (query.match(/^[A-Za-z:][\w:]*$/)) {
      return {
        selector: `{__name__="${query}"}`,
        labelKeys: ['__name__'],
      };
    }
    throw new Error('Query must contain a selector: ' + query);
  }

  // Check if inside a selector
  const prefix = query.slice(0, cursorOffset);
  const prefixOpen = prefix.lastIndexOf('{');
  const prefixClose = prefix.lastIndexOf('}');
  if (prefixOpen === -1) {
    throw new Error('Not inside selector, missing open brace: ' + prefix);
  }
  if (prefixClose > -1 && prefixClose > prefixOpen) {
    throw new Error('Not inside selector, previous selector already closed: ' + prefix);
  }
  const suffix = query.slice(cursorOffset);
  const suffixCloseIndex = suffix.indexOf('}');
  const suffixClose = suffixCloseIndex + cursorOffset;
  const suffixOpenIndex = suffix.indexOf('{');
  const suffixOpen = suffixOpenIndex + cursorOffset;
  if (suffixClose === -1) {
    throw new Error('Not inside selector, missing closing brace in suffix: ' + suffix);
  }
  if (suffixOpenIndex > -1 && suffixOpen < suffixClose) {
    throw new Error('Not inside selector, next selector opens before this one closed: ' + suffix);
  }

  // Extract clean labels to form clean selector, incomplete labels are dropped
  const selector = query.slice(prefixOpen, suffixClose);
  const labels: { [key: string]: { value: string; operator: string } } = {};
  selector.replace(labelRegexp, (label, key, operator, value) => {
    const labelOffset = query.indexOf(label);
    const valueStart = labelOffset + key.length + operator.length + 1;
    const valueEnd = labelOffset + key.length + operator.length + value.length - 1;
    // Skip label if cursor is in value
    if (cursorOffset < valueStart || cursorOffset > valueEnd) {
      labels[key] = { value, operator };
    }
    return '';
  });

  // Add metric if there is one before the selector
  const metricPrefix = query.slice(0, prefixOpen);
  const metricMatch = metricPrefix.match(/[A-Za-z:][\w:]*$/);
  if (metricMatch) {
    labels['__name__'] = { value: `"${metricMatch[0]}"`, operator: '=' };
  }

  // Build sorted selector
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map((key) => `${key}${labels[key].operator}${labels[key].value}`).join(',');

  const selectorString = ['{', cleanSelector, '}'].join('');

  return { labelKeys, selector: selectorString };
}

export function expandRecordingRules(query: string, mapping: { [name: string]: RecordingRuleIdentifier }): string {
  const getRuleRegex = (ruleName: string) => new RegExp(`(\\s|\\(|^)(${ruleName})(\\s|$|\\(|\\[|\\{)`, 'ig');

  // For each mapping key we iterate over the query and split them in parts.
  // recording:rule{label=~"/label/value"} * some:other:rule{other_label="value"}
  // We want to keep parts in here like this:
  // recording:rule
  // {label=~"/label/value"} *
  // some:other:rule
  // {other_label="value"}
  const tmpSplitParts = Object.keys(mapping).reduce<string[]>(
    (prev, curr) => {
      let parts: string[] = [];
      let tmpParts: string[] = [];
      let removeIdx: number[] = [];

      // we iterate over prev because it might be like this after first loop
      // recording:rule and {label=~"/label/value"} * some:other:rule{other_label="value"}
      // so we need to split the second part too
      prev.filter(Boolean).forEach((p, i) => {
        const doesMatch = p.match(getRuleRegex(curr));
        if (doesMatch) {
          parts = p.split(curr);
          if (parts.length === 2) {
            // this is the case when we have such result for this query
            // max (metric{label="value"})
            // "max(", "{label="value"}"
            removeIdx.push(i);
            tmpParts.push(...[parts[0], curr, parts[1]].filter(Boolean));
          } else if (parts.length > 2) {
            // this is the case when we have such query
            // metric + metric
            // when we split it we have such data
            // "", " + ", ""
            removeIdx.push(i);
            parts = parts.map((p) => (p === '' ? curr : p));
            tmpParts.push(...parts);
          }
        }
      });

      // if we have idx to remove that means we split the value in that index.
      // No need to keep it. Have the new split values instead.
      removeIdx.forEach((ri) => (prev[ri] = ''));
      prev = prev.filter(Boolean);
      prev.push(...tmpParts);

      return prev;
    },
    [query]
  );

  // we have the separate parts. we need to replace the metric and apply the labels if there is any
  let labelFound = false;
  const trulyExpandedQuery = tmpSplitParts.map((tsp, i) => {
    // if we know this loop tsp is a label, not the metric we want to expand
    if (labelFound) {
      labelFound = false;
      return '';
    }

    // check if the mapping is there
    if (mapping[tsp]) {
      const { expandedQuery: recordingRule, identifierValue, identifier } = mapping[tsp];
      // it is a recording rule. if the following is a label then apply it
      if (i + 1 !== tmpSplitParts.length && tmpSplitParts[i + 1].match(labelRegexp)) {
        // the next value in the loop is label. Let's apply labels to the metric
        labelFound = true;
        const regexp = new RegExp(`(,)?(\\s)?(${identifier}=\\"${identifierValue}\\")(,)?(\\s)?`, 'g');
        const labels = tmpSplitParts[i + 1].replace(regexp, '');
        const invalidLabelsRegex = /(\)\{|\}\{|\]\{)/;
        return addLabelsToExpression(recordingRule + labels, invalidLabelsRegex);
      } else {
        // it is not a recording rule and might be a binary operation in between two recording rules
        // So no need to do anything. just return it.
        return recordingRule;
      }
    }

    return tsp;
  });

  // Remove empty strings and merge them
  return trulyExpandedQuery.filter(Boolean).join('');
}

function addLabelsToExpression(expr: string, invalidLabelsRegexp: RegExp) {
  const match = expr.match(invalidLabelsRegexp);
  if (!match) {
    return expr;
  }

  // Split query into 2 parts - before the invalidLabelsRegex match and after.
  const indexOfRegexMatch = match.index ?? 0;
  const exprBeforeRegexMatch = expr.slice(0, indexOfRegexMatch + 1);
  const exprAfterRegexMatch = expr.slice(indexOfRegexMatch + 1);

  // Create arrayOfLabelObjects with label objects that have key, operator and value.
  const arrayOfLabelObjects: Array<{
    key: string;
    operator: string;
    value: string;
    comma?: string;
    space?: string;
  }> = [];
  exprAfterRegexMatch.replace(labelRegexp, (label, key, operator, value, comma, space) => {
    arrayOfLabelObjects.push({ key, operator, value, comma, space });
    return '';
  });

  // Loop through all label objects and add them to query.
  // As a starting point we have valid query without the labels.
  let result = exprBeforeRegexMatch;
  arrayOfLabelObjects.filter(Boolean).forEach((obj) => {
    // Remove extra set of quotes from obj.value
    const value = obj.value.slice(1, -1);
    result = addLabelToQuery(result, obj.key, value, obj.operator);
  });

  // reconstruct the labels
  let existingLabel = arrayOfLabelObjects.reduce((prev, curr) => {
    prev += `${curr.key}${curr.operator}${curr.value}${curr.comma ?? ''}${curr.space ?? ''}`;
    return prev;
  }, '');

  // Check if there is anything besides labels
  // Useful for this kind of metrics sum (recording_rule_metric{label1="value1"}) by (env)
  // if we don't check this part, ) by (env) part will be lost
  existingLabel = '{' + existingLabel + '}';
  const potentialLeftOver = exprAfterRegexMatch.replace(existingLabel, '');

  return result + potentialLeftOver;
}

/**
 * Adds metadata for synthetic metrics for which the API does not provide metadata.
 * See https://github.com/grafana/grafana/issues/22337 for details.
 *
 * @param metadata HELP and TYPE metadata from /api/v1/metadata
 */
export function fixSummariesMetadata(metadata: { [metric: string]: PromMetricsMetadataItem[] }): PromMetricsMetadata {
  if (!metadata) {
    return metadata;
  }
  const baseMetadata: PromMetricsMetadata = {};
  const summaryMetadata: PromMetricsMetadata = {};
  for (const metric in metadata) {
    // NOTE: based on prometheus-documentation, we can receive
    // multiple metadata-entries for the given metric, it seems
    // it happens when the same metric is on multiple targets
    // and their help-text differs
    // (https://prometheus.io/docs/prometheus/latest/querying/api/#querying-metric-metadata)
    // for now we just use the first entry.
    const item = metadata[metric][0];
    baseMetadata[metric] = item;

    if (item.type === 'histogram') {
      summaryMetadata[`${metric}_bucket`] = {
        type: 'counter',
        help: `Cumulative counters for the observation buckets (${item.help})`,
      };
      summaryMetadata[`${metric}_count`] = {
        type: 'counter',
        help: `Count of events that have been observed for the histogram metric (${item.help})`,
      };
      summaryMetadata[`${metric}_sum`] = {
        type: 'counter',
        help: `Total sum of all observed values for the histogram metric (${item.help})`,
      };
    }
    if (item.type === 'summary') {
      summaryMetadata[`${metric}_count`] = {
        type: 'counter',
        help: `Count of events that have been observed for the base metric (${item.help})`,
      };
      summaryMetadata[`${metric}_sum`] = {
        type: 'counter',
        help: `Total sum of all observed values for the base metric (${item.help})`,
      };
    }
  }
  // Synthetic series
  const syntheticMetadata: PromMetricsMetadata = {};
  syntheticMetadata['ALERTS'] = {
    type: 'gauge',
    help: 'Time series showing pending and firing alerts. The sample value is set to 1 as long as the alert is in the indicated active (pending or firing) state.',
  };

  return { ...baseMetadata, ...summaryMetadata, ...syntheticMetadata };
}

export function roundMsToMin(milliseconds: number): number {
  return roundSecToMin(milliseconds / 1000);
}

export function roundSecToMin(seconds: number): number {
  return Math.floor(seconds / 60);
}

// Returns number of minutes rounded up to the nearest nth minute
export function roundSecToNextMin(seconds: number, secondsToRound = 1): number {
  return Math.ceil(seconds / 60) - (Math.ceil(seconds / 60) % secondsToRound);
}

export function limitSuggestions(items: string[]) {
  return items.slice(0, SUGGESTIONS_LIMIT);
}

export function addLimitInfo(items: unknown[] | undefined): string {
  return items && items.length >= SUGGESTIONS_LIMIT ? `, limited to the first ${SUGGESTIONS_LIMIT} received items` : '';
}

// NOTE: the following 2 exported functions are very similar to the prometheus*Escape
// functions in datasource.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.

// Prometheus regular-expressions use the RE2 syntax (https://github.com/google/re2/wiki/Syntax),
// so every character that matches something in that list has to be escaped.
// the list of metacharacters is: *+?()|\.[]{}^$
// we make a javascript regular expression that matches those characters:
const RE2_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;

function escapePrometheusRegexp(value: string): string {
  return value.replace(RE2_METACHARACTERS, '\\$&');
}

// based on the openmetrics-documentation, the 3 symbols we have to handle are:
// - \n ... the newline character
// - \  ... the backslash character
// - "  ... the double-quote character
export function escapeLabelValueInExactSelector(labelValue: string): string {
  return labelValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export function escapeLabelValueInRegexSelector(labelValue: string): string {
  return escapeLabelValueInExactSelector(escapePrometheusRegexp(labelValue));
}

const FromPromLikeMap: Record<string, AbstractLabelOperator> = {
  '=': AbstractLabelOperator.Equal,
  '!=': AbstractLabelOperator.NotEqual,
  '=~': AbstractLabelOperator.EqualRegEx,
  '!~': AbstractLabelOperator.NotEqualRegEx,
};

const ToPromLikeMap: Record<AbstractLabelOperator, string> = invert(FromPromLikeMap) as Record<
  AbstractLabelOperator,
  string
>;

export function toPromLikeExpr(labelBasedQuery: AbstractQuery): string {
  const expr = labelBasedQuery.labelMatchers
    .map((selector: AbstractLabelMatcher) => {
      const operator = ToPromLikeMap[selector.operator];
      if (operator) {
        return `${selector.name}${operator}"${selector.value}"`;
      } else {
        return '';
      }
    })
    .filter((e: string) => e !== '')
    .join(', ');

  return expr ? `{${expr}}` : '';
}

export function toPromLikeQuery(labelBasedQuery: AbstractQuery): PromLikeQuery {
  return {
    refId: labelBasedQuery.refId,
    expr: toPromLikeExpr(labelBasedQuery),
    range: true,
  };
}

export interface PromLikeQuery extends DataQuery {
  expr: string;
  range: boolean;
}

function getMaybeTokenStringContent(token: Token): string {
  if (typeof token.content === 'string') {
    return token.content;
  }

  return '';
}

export function extractLabelMatchers(tokens: Array<string | Token>): AbstractLabelMatcher[] {
  const labelMatchers: AbstractLabelMatcher[] = [];

  for (const token of tokens) {
    if (!(token instanceof Token)) {
      continue;
    }

    if (token.type === 'context-labels') {
      let labelKey = '';
      let labelValue = '';
      let labelOperator = '';

      const contentTokens = Array.isArray(token.content) ? token.content : [token.content];

      for (let currentToken of contentTokens) {
        if (typeof currentToken === 'string') {
          let currentStr: string;
          currentStr = currentToken;
          if (currentStr === '=' || currentStr === '!=' || currentStr === '=~' || currentStr === '!~') {
            labelOperator = currentStr;
          }
        } else if (currentToken instanceof Token) {
          switch (currentToken.type) {
            case 'label-key':
              labelKey = getMaybeTokenStringContent(currentToken);
              break;
            case 'label-value':
              labelValue = getMaybeTokenStringContent(currentToken);
              labelValue = labelValue.substring(1, labelValue.length - 1);
              const labelComparator = FromPromLikeMap[labelOperator];
              if (labelComparator) {
                labelMatchers.push({ name: labelKey, operator: labelComparator, value: labelValue });
              }
              break;
          }
        }
      }
    }
  }

  return labelMatchers;
}

/**
 * Calculates new interval "snapped" to the closest Nth minute, depending on cache level datasource setting
 * @param cacheLevel
 * @param range
 */
export function getRangeSnapInterval(
  cacheLevel: PrometheusCacheLevel,
  range: TimeRange
): {
  start: string;
  end: string;
} {
  // Don't round the range if we're not caching
  if (cacheLevel === PrometheusCacheLevel.None) {
    return {
      start: getPrometheusTime(range.from, false).toString(),
      end: getPrometheusTime(range.to, true).toString(),
    };
  }
  // Otherwise round down to the nearest nth minute for the start time
  const startTime = getPrometheusTime(range.from, false);
  // const startTimeQuantizedSeconds = roundSecToLastMin(startTime, getClientCacheDurationInMinutes(cacheLevel)) * 60;
  const startTimeQuantizedSeconds = incrRoundDn(startTime, getClientCacheDurationInMinutes(cacheLevel) * 60);

  // And round up to the nearest nth minute for the end time
  const endTime = getPrometheusTime(range.to, true);
  const endTimeQuantizedSeconds = roundSecToNextMin(endTime, getClientCacheDurationInMinutes(cacheLevel)) * 60;

  // If the interval was too short, we could have rounded both start and end to the same time, if so let's add one step to the end
  if (startTimeQuantizedSeconds === endTimeQuantizedSeconds) {
    const endTimePlusOneStep = endTimeQuantizedSeconds + getClientCacheDurationInMinutes(cacheLevel) * 60;
    return { start: startTimeQuantizedSeconds.toString(), end: endTimePlusOneStep.toString() };
  }

  const start = startTimeQuantizedSeconds.toString();
  const end = endTimeQuantizedSeconds.toString();

  return { start, end };
}

export function getClientCacheDurationInMinutes(cacheLevel: PrometheusCacheLevel) {
  switch (cacheLevel) {
    case PrometheusCacheLevel.Medium:
      return 10;
    case PrometheusCacheLevel.High:
      return 60;
    default:
      return 1;
  }
}

export function getPrometheusTime(date: string | DateTime, roundUp: boolean) {
  if (typeof date === 'string') {
    date = dateMath.parse(date, roundUp)!;
  }

  return Math.ceil(date.valueOf() / 1000);
}

/**
 * Used to truncate metrics, label names and label value in the query builder select components
 * to improve frontend performance. This is best used with an async select component including
 * the loadOptions property where we should still allow users to search all results with a string.
 * This can be done either storing the total results or querying an api that allows for matching a query.
 *
 * @param array
 * @param limit
 * @returns
 */
export function truncateResult<T>(array: T[], limit?: number): T[] {
  if (limit === undefined) {
    limit = PROMETHEUS_QUERY_BUILDER_MAX_RESULTS;
  }
  array.length = Math.min(array.length, limit);
  return array;
}
