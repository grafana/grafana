import _ from 'lodash';
var keywords = 'by|without|on|ignoring|group_left|group_right';
// Duplicate from mode-prometheus.js, which can't be used in tests due to global ace not being loaded.
var builtInWords = [
    keywords,
    'count|count_values|min|max|avg|sum|stddev|stdvar|bottomk|topk|quantile',
    'true|false|null|__name__|job',
    'abs|absent|ceil|changes|clamp_max|clamp_min|count_scalar|day_of_month|day_of_week|days_in_month|delta|deriv',
    'drop_common_labels|exp|floor|histogram_quantile|holt_winters|hour|idelta|increase|irate|label_replace|ln|log2',
    'log10|minute|month|predict_linear|rate|resets|round|scalar|sort|sort_desc|sqrt|time|vector|year|avg_over_time',
    'min_over_time|max_over_time|sum_over_time|count_over_time|quantile_over_time|stddev_over_time|stdvar_over_time',
]
    .join('|')
    .split('|');
var metricNameRegexp = /([A-Za-z:][\w:]*)\b(?![\(\]{=!",])/g;
var selectorRegexp = /{([^{]*)}/g;
// addLabelToQuery('foo', 'bar', 'baz') => 'foo{bar="baz"}'
export function addLabelToQuery(query, key, value, operator) {
    if (!key || !value) {
        throw new Error('Need label to add to query.');
    }
    // Add empty selectors to bare metric names
    var previousWord;
    query = query.replace(metricNameRegexp, function (match, word, offset) {
        var insideSelector = isPositionInsideChars(query, offset, '{', '}');
        // Handle "sum by (key) (metric)"
        var previousWordIsKeyWord = previousWord && keywords.split('|').indexOf(previousWord) > -1;
        previousWord = word;
        if (!insideSelector && !previousWordIsKeyWord && builtInWords.indexOf(word) === -1) {
            return word + "{}";
        }
        return word;
    });
    // Adding label to existing selectors
    var match = selectorRegexp.exec(query);
    var parts = [];
    var lastIndex = 0;
    var suffix = '';
    while (match) {
        var prefix = query.slice(lastIndex, match.index);
        var selector = match[1];
        var selectorWithLabel = addLabelToSelector(selector, key, value, operator);
        lastIndex = match.index + match[1].length + 2;
        suffix = query.slice(match.index + match[0].length);
        parts.push(prefix, selectorWithLabel);
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
    var formatted = _.chain(parsedLabels)
        .uniqWith(_.isEqual)
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
export default addLabelToQuery;
//# sourceMappingURL=add_label_to_query.js.map