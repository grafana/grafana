import { PromMetricsMetadata } from './types';
import { addLabelToQuery } from './add_label_to_query';
import { SUGGESTIONS_LIMIT } from './language_provider';

export const processHistogramLabels = (labels: string[]) => {
  const resultSet: Set<string> = new Set();
  const regexp = new RegExp('_bucket($|:)');
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    const isHistogramValue = regexp.test(label);
    if (isHistogramValue) {
      resultSet.add(label);
    }
  }
  const result = [...resultSet];

  return { values: { __name__: result } };
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
export const labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")/g;
export function parseSelector(query: string, cursorOffset = 1): { labelKeys: any[]; selector: string } {
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

export function expandRecordingRules(query: string, mapping: { [name: string]: string }): string {
  const ruleNames = Object.keys(mapping);
  const rulesRegex = new RegExp(`(\\s|^)(${ruleNames.join('|')})(\\s|$|\\(|\\[|\\{)`, 'ig');
  const expandedQuery = query.replace(rulesRegex, (match, pre, name, post) => `${pre}${mapping[name]}${post}`);

  // Split query into array, so if query uses operators, we can correctly add labels to each individual part.
  const queryArray = expandedQuery.split(/(\+|\-|\*|\/|\%|\^)/);

  // Regex that matches occurrences of ){ or }{ or ]{ which is a sign of incorrecly added labels.
  const invalidLabelsRegex = /(\)\{|\}\{|\]\{)/;
  const correctlyExpandedQueryArray = queryArray.map((query) => {
    return addLabelsToExpression(query, invalidLabelsRegex);
  });

  return correctlyExpandedQueryArray.join('');
}

function addLabelsToExpression(expr: string, invalidLabelsRegexp: RegExp) {
  const match = expr.match(invalidLabelsRegexp);
  if (!match) {
    return expr;
  }

  // Split query into 2 parts - before the invalidLabelsRegex match and after.
  const indexOfRegexMatch = match.index ?? 0;
  const exprBeforeRegexMatch = expr.substr(0, indexOfRegexMatch + 1);
  const exprAfterRegexMatch = expr.substr(indexOfRegexMatch + 1);

  // Create arrayOfLabelObjects with label objects that have key, operator and value.
  const arrayOfLabelObjects: Array<{ key: string; operator: string; value: string }> = [];
  exprAfterRegexMatch.replace(labelRegexp, (label, key, operator, value) => {
    arrayOfLabelObjects.push({ key, operator, value });
    return '';
  });

  // Loop trough all of the label objects and add them to query.
  // As a starting point we have valid query without the labels.
  let result = exprBeforeRegexMatch;
  arrayOfLabelObjects.filter(Boolean).forEach((obj) => {
    // Remove extra set of quotes from obj.value
    const value = obj.value.substr(1, obj.value.length - 2);
    result = addLabelToQuery(result, obj.key, value, obj.operator);
  });

  return result;
}

/**
 * Adds metadata for synthetic metrics for which the API does not provide metadata.
 * See https://github.com/grafana/grafana/issues/22337 for details.
 *
 * @param metadata HELP and TYPE metadata from /api/v1/metadata
 */
export function fixSummariesMetadata(metadata: PromMetricsMetadata): PromMetricsMetadata {
  if (!metadata) {
    return metadata;
  }
  const summaryMetadata: PromMetricsMetadata = {};
  for (const metric in metadata) {
    const item = metadata[metric][0];
    if (item.type === 'histogram') {
      summaryMetadata[`${metric}_bucket`] = [
        {
          type: 'counter',
          help: `Cumulative counters for the observation buckets (${item.help})`,
        },
      ];
      summaryMetadata[`${metric}_count`] = [
        {
          type: 'counter',
          help: `Count of events that have been observed for the histogram metric (${item.help})`,
        },
      ];
      summaryMetadata[`${metric}_sum`] = [
        {
          type: 'counter',
          help: `Total sum of all observed values for the histogram metric (${item.help})`,
        },
      ];
    }
    if (item.type === 'summary') {
      summaryMetadata[`${metric}_count`] = [
        {
          type: 'counter',
          help: `Count of events that have been observed for the base metric (${item.help})`,
        },
      ];
      summaryMetadata[`${metric}_sum`] = [
        {
          type: 'counter',
          help: `Total sum of all observed values for the base metric (${item.help})`,
        },
      ];
    }
  }
  // Synthetic series
  const syntheticMetadata: PromMetricsMetadata = {};
  syntheticMetadata['ALERTS'] = [
    {
      type: 'counter',
      help:
        'Time series showing pending and firing alerts. The sample value is set to 1 as long as the alert is in the indicated active (pending or firing) state.',
    },
  ];

  return { ...metadata, ...summaryMetadata, ...syntheticMetadata };
}

export function roundMsToMin(milliseconds: number): number {
  return roundSecToMin(milliseconds / 1000);
}

export function roundSecToMin(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function limitSuggestions(items: string[]) {
  return items.slice(0, SUGGESTIONS_LIMIT);
}

export function addLimitInfo(items: any[] | undefined): string {
  return items && items.length >= SUGGESTIONS_LIMIT ? `, limited to the first ${SUGGESTIONS_LIMIT} received items` : '';
}
