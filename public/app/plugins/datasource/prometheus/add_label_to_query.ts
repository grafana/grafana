import _ from 'lodash';

const keywords = 'by|without|on|ignoring|group_left|group_right|bool';
const logicalOperators = 'or|and|unless';

// Duplicate from mode-prometheus.js, which can't be used in tests due to global ace not being loaded.
const builtInWords = [
  keywords,
  logicalOperators,
  'count|count_values|min|max|avg|sum|stddev|stdvar|bottomk|topk|quantile',
  'true|false|null|__name__|job',
  'abs|absent|ceil|changes|clamp_max|clamp_min|count_scalar|day_of_month|day_of_week|days_in_month|delta|deriv',
  'drop_common_labels|exp|floor|histogram_quantile|holt_winters|hour|idelta|increase|irate|label_replace|ln|log2',
  'log10|minute|month|predict_linear|rate|resets|round|scalar|sort|sort_desc|sqrt|time|vector|year|avg_over_time',
  'min_over_time|max_over_time|sum_over_time|count_over_time|quantile_over_time|stddev_over_time|stdvar_over_time',
]
  .join('|')
  .split('|');

// We want to extract all possible metrics and also keywords
const metricsAndKeywordsRegexp = /([A-Za-z:][\w:]*)\b(?![\]{=!",])/g;
// Safari currently doesn't support negative lookbehind. When it does, we should refactor this.
// We are creating 2 matching groups. (\$) is for the Grafana's variables such as ${__rate_s}. We want to ignore
// ${__rate_s} and not add variable to it.
const selectorRegexp = /(\$)?{([^{]*)}/g;

export function addLabelToQuery(
  query: string,
  key: string,
  value: string | number,
  operator?: string,
  hasNoMetrics?: boolean
): string {
  if (!key || !value) {
    throw new Error('Need label to add to query.');
  }

  // We need to make sure that we convert the value back to string because it may be a number
  const transformedValue = value === Infinity ? '+Inf' : value.toString();

  // Add empty selectors to bare metric names
  let previousWord: string;

  query = query.replace(metricsAndKeywordsRegexp, (match, word, offset) => {
    const isMetric = isWordMetric(query, word, offset, previousWord, hasNoMetrics);
    previousWord = word;

    return isMetric ? `${word}{}` : word;
  });

  // Adding label to existing selectors
  let match = selectorRegexp.exec(query);
  const parts = [];
  let lastIndex = 0;
  let suffix = '';

  while (match) {
    const prefix = query.slice(lastIndex, match.index);
    lastIndex = match.index + match[2].length + 2;
    suffix = query.slice(match.index + match[0].length);
    // If we matched 1st group, we know it is Grafana's variable and we don't want to add labels
    if (match[1]) {
      parts.push(prefix);
      parts.push(match[0]);
    } else {
      // If we didn't match first group, we are inside selector and we want to add labels
      const selector = match[2];
      const selectorWithLabel = addLabelToSelector(selector, key, transformedValue, operator);
      parts.push(prefix, selectorWithLabel);
    }

    match = selectorRegexp.exec(query);
  }

  parts.push(suffix);
  return parts.join('');
}

const labelRegexp = /(\w+)\s*(=|!=|=~|!~)\s*("[^"]*")/g;

export function addLabelToSelector(selector: string, labelKey: string, labelValue: string, labelOperator?: string) {
  const parsedLabels = [];

  // Split selector into labels
  if (selector) {
    let match = labelRegexp.exec(selector);
    while (match) {
      parsedLabels.push({ key: match[1], operator: match[2], value: match[3] });
      match = labelRegexp.exec(selector);
    }
  }

  // Add new label
  const operatorForLabelKey = labelOperator || '=';
  parsedLabels.push({ key: labelKey, operator: operatorForLabelKey, value: `"${labelValue}"` });

  // Sort labels by key and put them together
  const formatted = _.chain(parsedLabels)
    .uniqWith(_.isEqual)
    .compact()
    .sortBy('key')
    .map(({ key, operator, value }) => `${key}${operator}${value}`)
    .value()
    .join(',');

  return `{${formatted}}`;
}

function isPositionInsideChars(text: string, position: number, openChar: string, closeChar: string) {
  const nextSelectorStart = text.slice(position).indexOf(openChar);
  const nextSelectorEnd = text.slice(position).indexOf(closeChar);
  return nextSelectorEnd > -1 && (nextSelectorStart === -1 || nextSelectorStart > nextSelectorEnd);
}

function isWordMetric(query: string, word: string, offset: number, previousWord: string, hasNoMetrics?: boolean) {
  const insideSelector = isPositionInsideChars(query, offset, '{', '}');
  // Handle "sum by (key) (metric)"
  const previousWordIsKeyWord = previousWord && keywords.split('|').indexOf(previousWord) > -1;
  // Check for colon as as "word boundary" symbol
  const isColonBounded = word.endsWith(':');
  // Check for words that start with " which means that they are not metrics
  const startsWithQuote = query[offset - 1] === '"';
  // Check for template variables
  const isTemplateVariable = query[offset - 1] === '$';
  // Check for time units
  const isTimeUnit = ['s', 'm', 'h', 'd', 'w'].includes(word) && Boolean(Number(query[offset - 1]));

  if (
    !hasNoMetrics &&
    !insideSelector &&
    !isColonBounded &&
    !previousWordIsKeyWord &&
    !startsWithQuote &&
    !isTemplateVariable &&
    !isTimeUnit &&
    builtInWords.indexOf(word) === -1
  ) {
    return true;
  }
  return false;
}

export default addLabelToQuery;
