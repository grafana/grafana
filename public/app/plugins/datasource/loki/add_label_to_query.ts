import { chain, isEqual } from 'lodash';
import { LOKI_KEYWORDS } from './syntax';
import { PROM_KEYWORDS, OPERATORS, LOGICAL_OPERATORS } from 'app/plugins/datasource/prometheus/promql';

const builtInWords = [...PROM_KEYWORDS, ...OPERATORS, ...LOGICAL_OPERATORS, ...LOKI_KEYWORDS];

// We want to extract all possible metrics and also keywords
const metricsAndKeywordsRegexp = /([A-Za-z:][\w:]*)\b(?![\]{=!",])/g;

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

  //This is a RegExp for stream selector - e.g. {job="grafana"}
  const selectorRegexp = /(\$)?{([^{]*)}/g;
  const parts = [];
  let lastIndex = 0;
  let suffix = '';

  let match = selectorRegexp.exec(query);
  /* 
    There are 2 possible false positive scenarios: 
    
    1. We match Grafana's variables with ${ syntax - such as${__rate_s}. To filter these out we could use negative lookbehind,
    but Safari browser currently doesn't support it. Therefore we need to hack this by creating 2 matching groups. 
    (\$) is for the Grafana's variables and if we match it, we know this is not a stream selector and we don't want to add label.

    2. Log queries can include {{.label}} syntax when line_format is used. We need to filter these out by checking
    if match starts with "{."
  */
  while (match) {
    const prefix = query.slice(lastIndex, match.index);
    lastIndex = match.index + match[2].length + 2;
    suffix = query.slice(match.index + match[0].length);

    // Filtering our false positives
    if (match[0].startsWith('{.') || match[1]) {
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
  const formatted = chain(parsedLabels)
    .uniqWith(isEqual)
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
  const previousWordIsKeyWord = previousWord && OPERATORS.indexOf(previousWord) > -1;
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
