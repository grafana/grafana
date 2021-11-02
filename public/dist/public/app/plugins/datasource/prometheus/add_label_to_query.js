import { chain, isEqual } from 'lodash';
var keywords = 'by|without|on|ignoring|group_left|group_right|bool';
var logicalOperators = 'or|and|unless';
// Duplicate from mode-prometheus.js, which can't be used in tests due to global ace not being loaded.
var builtInWords = [
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
var metricsAndKeywordsRegexp = /([A-Za-z:][\w:]*)\b(?![\]{=!",])/g;
// Safari currently doesn't support negative lookbehind. When it does, we should refactor this.
// We are creating 2 matching groups. (\$) is for the Grafana's variables such as ${__rate_s}. We want to ignore
// ${__rate_s} and not add variable to it.
var selectorRegexp = /(\$)?{([^{]*)}/g;
export function addLabelToQuery(query, key, value, operator, hasNoMetrics) {
    if (!key || !value) {
        throw new Error('Need label to add to query.');
    }
    // We need to make sure that we convert the value back to string because it may be a number
    var transformedValue = value === Infinity ? '+Inf' : value.toString();
    // Add empty selectors to bare metric names
    var previousWord;
    query = query.replace(metricsAndKeywordsRegexp, function (match, word, offset) {
        var isMetric = isWordMetric(query, word, offset, previousWord, hasNoMetrics);
        previousWord = word;
        return isMetric ? word + "{}" : word;
    });
    // Adding label to existing selectors
    var match = selectorRegexp.exec(query);
    var parts = [];
    var lastIndex = 0;
    var suffix = '';
    while (match) {
        var prefix = query.slice(lastIndex, match.index);
        lastIndex = match.index + match[2].length + 2;
        suffix = query.slice(match.index + match[0].length);
        // If we matched 1st group, we know it is Grafana's variable and we don't want to add labels
        if (match[1]) {
            parts.push(prefix);
            parts.push(match[0]);
        }
        else {
            // If we didn't match first group, we are inside selector and we want to add labels
            var selector = match[2];
            var selectorWithLabel = addLabelToSelector(selector, key, transformedValue, operator);
            parts.push(prefix, selectorWithLabel);
        }
        match = selectorRegexp.exec(query);
    }
    parts.push(suffix);
    return parts.join('');
}
var labelRegexp = /(\w+)\s*(=|!=|=~|!~)\s*("[^"]*")/g;
export function addLabelToSelector(selector, labelKey, labelValue, labelOperator) {
    var parsedLabels = [];
    // Split selector into labels
    if (selector) {
        var match = labelRegexp.exec(selector);
        while (match) {
            parsedLabels.push({ key: match[1], operator: match[2], value: match[3] });
            match = labelRegexp.exec(selector);
        }
    }
    // Add new label
    var operatorForLabelKey = labelOperator || '=';
    parsedLabels.push({ key: labelKey, operator: operatorForLabelKey, value: "\"" + labelValue + "\"" });
    // Sort labels by key and put them together
    var formatted = chain(parsedLabels)
        .uniqWith(isEqual)
        .compact()
        .sortBy('key')
        .map(function (_a) {
        var key = _a.key, operator = _a.operator, value = _a.value;
        return "" + key + operator + value;
    })
        .value()
        .join(',');
    return "{" + formatted + "}";
}
function isPositionInsideChars(text, position, openChar, closeChar) {
    var nextSelectorStart = text.slice(position).indexOf(openChar);
    var nextSelectorEnd = text.slice(position).indexOf(closeChar);
    return nextSelectorEnd > -1 && (nextSelectorStart === -1 || nextSelectorStart > nextSelectorEnd);
}
function isWordMetric(query, word, offset, previousWord, hasNoMetrics) {
    var insideSelector = isPositionInsideChars(query, offset, '{', '}');
    // Handle "sum by (key) (metric)"
    var previousWordIsKeyWord = previousWord && keywords.split('|').indexOf(previousWord) > -1;
    // Check for colon as as "word boundary" symbol
    var isColonBounded = word.endsWith(':');
    // Check for words that start with " which means that they are not metrics
    var startsWithQuote = query[offset - 1] === '"';
    // Check for template variables
    var isTemplateVariable = query[offset - 1] === '$';
    // Check for time units
    var isTimeUnit = ['s', 'm', 'h', 'd', 'w'].includes(word) && Boolean(Number(query[offset - 1]));
    if (!hasNoMetrics &&
        !insideSelector &&
        !isColonBounded &&
        !previousWordIsKeyWord &&
        !startsWithQuote &&
        !isTemplateVariable &&
        !isTimeUnit &&
        builtInWords.indexOf(word) === -1) {
        return true;
    }
    return false;
}
export default addLabelToQuery;
//# sourceMappingURL=add_label_to_query.js.map