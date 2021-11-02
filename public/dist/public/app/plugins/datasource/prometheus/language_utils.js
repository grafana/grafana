import { __assign, __read, __rest, __spreadArray } from "tslib";
import { addLabelToQuery } from './add_label_to_query';
import { SUGGESTIONS_LIMIT } from './language_provider';
export var processHistogramMetrics = function (metrics) {
    var resultSet = new Set();
    var regexp = new RegExp('_bucket($|:)');
    for (var index = 0; index < metrics.length; index++) {
        var metric = metrics[index];
        var isHistogramValue = regexp.test(metric);
        if (isHistogramValue) {
            resultSet.add(metric);
        }
    }
    return __spreadArray([], __read(resultSet), false);
};
export function processLabels(labels, withName) {
    if (withName === void 0) { withName = false; }
    // For processing we are going to use sets as they have significantly better performance than arrays
    // After we process labels, we will convert sets to arrays and return object with label values in arrays
    var valueSet = {};
    labels.forEach(function (label) {
        var __name__ = label.__name__, rest = __rest(label, ["__name__"]);
        if (withName) {
            valueSet['__name__'] = valueSet['__name__'] || new Set();
            if (!valueSet['__name__'].has(__name__)) {
                valueSet['__name__'].add(__name__);
            }
        }
        Object.keys(rest).forEach(function (key) {
            if (!valueSet[key]) {
                valueSet[key] = new Set();
            }
            if (!valueSet[key].has(rest[key])) {
                valueSet[key].add(rest[key]);
            }
        });
    });
    // valueArray that we are going to return in the object
    var valueArray = {};
    limitSuggestions(Object.keys(valueSet)).forEach(function (key) {
        valueArray[key] = limitSuggestions(Array.from(valueSet[key]));
    });
    return { values: valueArray, keys: Object.keys(valueArray) };
}
// const cleanSelectorRegexp = /\{(\w+="[^"\n]*?")(,\w+="[^"\n]*?")*\}/;
export var selectorRegexp = /\{[^}]*?(\}|$)/;
export var labelRegexp = /\b(\w+)(!?=~?)("[^"\n]*?")/g;
export function parseSelector(query, cursorOffset) {
    if (cursorOffset === void 0) { cursorOffset = 1; }
    if (!query.match(selectorRegexp)) {
        // Special matcher for metrics
        if (query.match(/^[A-Za-z:][\w:]*$/)) {
            return {
                selector: "{__name__=\"" + query + "\"}",
                labelKeys: ['__name__'],
            };
        }
        throw new Error('Query must contain a selector: ' + query);
    }
    // Check if inside a selector
    var prefix = query.slice(0, cursorOffset);
    var prefixOpen = prefix.lastIndexOf('{');
    var prefixClose = prefix.lastIndexOf('}');
    if (prefixOpen === -1) {
        throw new Error('Not inside selector, missing open brace: ' + prefix);
    }
    if (prefixClose > -1 && prefixClose > prefixOpen) {
        throw new Error('Not inside selector, previous selector already closed: ' + prefix);
    }
    var suffix = query.slice(cursorOffset);
    var suffixCloseIndex = suffix.indexOf('}');
    var suffixClose = suffixCloseIndex + cursorOffset;
    var suffixOpenIndex = suffix.indexOf('{');
    var suffixOpen = suffixOpenIndex + cursorOffset;
    if (suffixClose === -1) {
        throw new Error('Not inside selector, missing closing brace in suffix: ' + suffix);
    }
    if (suffixOpenIndex > -1 && suffixOpen < suffixClose) {
        throw new Error('Not inside selector, next selector opens before this one closed: ' + suffix);
    }
    // Extract clean labels to form clean selector, incomplete labels are dropped
    var selector = query.slice(prefixOpen, suffixClose);
    var labels = {};
    selector.replace(labelRegexp, function (label, key, operator, value) {
        var labelOffset = query.indexOf(label);
        var valueStart = labelOffset + key.length + operator.length + 1;
        var valueEnd = labelOffset + key.length + operator.length + value.length - 1;
        // Skip label if cursor is in value
        if (cursorOffset < valueStart || cursorOffset > valueEnd) {
            labels[key] = { value: value, operator: operator };
        }
        return '';
    });
    // Add metric if there is one before the selector
    var metricPrefix = query.slice(0, prefixOpen);
    var metricMatch = metricPrefix.match(/[A-Za-z:][\w:]*$/);
    if (metricMatch) {
        labels['__name__'] = { value: "\"" + metricMatch[0] + "\"", operator: '=' };
    }
    // Build sorted selector
    var labelKeys = Object.keys(labels).sort();
    var cleanSelector = labelKeys.map(function (key) { return "" + key + labels[key].operator + labels[key].value; }).join(',');
    var selectorString = ['{', cleanSelector, '}'].join('');
    return { labelKeys: labelKeys, selector: selectorString };
}
export function expandRecordingRules(query, mapping) {
    var ruleNames = Object.keys(mapping);
    var rulesRegex = new RegExp("(\\s|^)(" + ruleNames.join('|') + ")(\\s|$|\\(|\\[|\\{)", 'ig');
    var expandedQuery = query.replace(rulesRegex, function (match, pre, name, post) { return "" + pre + mapping[name] + post; });
    // Split query into array, so if query uses operators, we can correctly add labels to each individual part.
    var queryArray = expandedQuery.split(/(\+|\-|\*|\/|\%|\^)/);
    // Regex that matches occurrences of ){ or }{ or ]{ which is a sign of incorrecly added labels.
    var invalidLabelsRegex = /(\)\{|\}\{|\]\{)/;
    var correctlyExpandedQueryArray = queryArray.map(function (query) {
        return addLabelsToExpression(query, invalidLabelsRegex);
    });
    return correctlyExpandedQueryArray.join('');
}
function addLabelsToExpression(expr, invalidLabelsRegexp) {
    var _a;
    var match = expr.match(invalidLabelsRegexp);
    if (!match) {
        return expr;
    }
    // Split query into 2 parts - before the invalidLabelsRegex match and after.
    var indexOfRegexMatch = (_a = match.index) !== null && _a !== void 0 ? _a : 0;
    var exprBeforeRegexMatch = expr.substr(0, indexOfRegexMatch + 1);
    var exprAfterRegexMatch = expr.substr(indexOfRegexMatch + 1);
    // Create arrayOfLabelObjects with label objects that have key, operator and value.
    var arrayOfLabelObjects = [];
    exprAfterRegexMatch.replace(labelRegexp, function (label, key, operator, value) {
        arrayOfLabelObjects.push({ key: key, operator: operator, value: value });
        return '';
    });
    // Loop trough all of the label objects and add them to query.
    // As a starting point we have valid query without the labels.
    var result = exprBeforeRegexMatch;
    arrayOfLabelObjects.filter(Boolean).forEach(function (obj) {
        // Remove extra set of quotes from obj.value
        var value = obj.value.substr(1, obj.value.length - 2);
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
export function fixSummariesMetadata(metadata) {
    if (!metadata) {
        return metadata;
    }
    var baseMetadata = {};
    var summaryMetadata = {};
    for (var metric in metadata) {
        // NOTE: based on prometheus-documentation, we can receive
        // multiple metadata-entries for the given metric, it seems
        // it happens when the same metric is on multiple targets
        // and their help-text differs
        // (https://prometheus.io/docs/prometheus/latest/querying/api/#querying-metric-metadata)
        // for now we just use the first entry.
        var item = metadata[metric][0];
        baseMetadata[metric] = item;
        if (item.type === 'histogram') {
            summaryMetadata[metric + "_bucket"] = {
                type: 'counter',
                help: "Cumulative counters for the observation buckets (" + item.help + ")",
            };
            summaryMetadata[metric + "_count"] = {
                type: 'counter',
                help: "Count of events that have been observed for the histogram metric (" + item.help + ")",
            };
            summaryMetadata[metric + "_sum"] = {
                type: 'counter',
                help: "Total sum of all observed values for the histogram metric (" + item.help + ")",
            };
        }
        if (item.type === 'summary') {
            summaryMetadata[metric + "_count"] = {
                type: 'counter',
                help: "Count of events that have been observed for the base metric (" + item.help + ")",
            };
            summaryMetadata[metric + "_sum"] = {
                type: 'counter',
                help: "Total sum of all observed values for the base metric (" + item.help + ")",
            };
        }
    }
    // Synthetic series
    var syntheticMetadata = {};
    syntheticMetadata['ALERTS'] = {
        type: 'counter',
        help: 'Time series showing pending and firing alerts. The sample value is set to 1 as long as the alert is in the indicated active (pending or firing) state.',
    };
    return __assign(__assign(__assign({}, baseMetadata), summaryMetadata), syntheticMetadata);
}
export function roundMsToMin(milliseconds) {
    return roundSecToMin(milliseconds / 1000);
}
export function roundSecToMin(seconds) {
    return Math.floor(seconds / 60);
}
export function limitSuggestions(items) {
    return items.slice(0, SUGGESTIONS_LIMIT);
}
export function addLimitInfo(items) {
    return items && items.length >= SUGGESTIONS_LIMIT ? ", limited to the first " + SUGGESTIONS_LIMIT + " received items" : '';
}
// NOTE: the following 2 exported functions are very similar to the prometheus*Escape
// functions in datasource.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.
// Prometheus regular-expressions use the RE2 syntax (https://github.com/google/re2/wiki/Syntax),
// so every character that matches something in that list has to be escaped.
// the list of metacharacters is: *+?()|\.[]{}^$
// we make a javascript regular expression that matches those characters:
var RE2_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;
function escapePrometheusRegexp(value) {
    return value.replace(RE2_METACHARACTERS, '\\$&');
}
// based on the openmetrics-documentation, the 3 symbols we have to handle are:
// - \n ... the newline character
// - \  ... the backslash character
// - "  ... the double-quote character
export function escapeLabelValueInExactSelector(labelValue) {
    return labelValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}
export function escapeLabelValueInRegexSelector(labelValue) {
    return escapeLabelValueInExactSelector(escapePrometheusRegexp(labelValue));
}
//# sourceMappingURL=language_utils.js.map