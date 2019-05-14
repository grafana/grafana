import * as tslib_1 from "tslib";
export var RATE_RANGES = ['1m', '5m', '10m', '30m', '1h'];
export function processLabels(labels, withName) {
    if (withName === void 0) { withName = false; }
    var values = {};
    labels.forEach(function (l) {
        var __name__ = l.__name__, rest = tslib_1.__rest(l, ["__name__"]);
        if (withName) {
            values['__name__'] = values['__name__'] || [];
            if (values['__name__'].indexOf(__name__) === -1) {
                values['__name__'].push(__name__);
            }
        }
        Object.keys(rest).forEach(function (key) {
            if (!values[key]) {
                values[key] = [];
            }
            if (values[key].indexOf(rest[key]) === -1) {
                values[key].push(rest[key]);
            }
        });
    });
    return { values: values, keys: Object.keys(values) };
}
// const cleanSelectorRegexp = /\{(\w+="[^"\n]*?")(,\w+="[^"\n]*?")*\}/;
export var selectorRegexp = /\{[^}]*?\}/;
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
    selector.replace(labelRegexp, function (_, key, operator, value) {
        labels[key] = { value: value, operator: operator };
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
    return query.replace(rulesRegex, function (match, pre, name, post) { return "" + pre + mapping[name] + post; });
}
//# sourceMappingURL=language_utils.js.map