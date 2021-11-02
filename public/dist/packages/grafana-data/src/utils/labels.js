import { __assign, __read, __values } from "tslib";
/**
 * Regexp to extract Prometheus-style labels
 */
var labelRegexp = /\b(\w+)(!?=~?)"([^"\n]*?)"/g;
/**
 * Returns a map of label keys to value from an input selector string.
 *
 * Example: `parseLabels('{job="foo", instance="bar"}) // {job: "foo", instance: "bar"}`
 */
export function parseLabels(labels) {
    var labelsByKey = {};
    labels.replace(labelRegexp, function (_, key, operator, value) {
        labelsByKey[key] = value;
        return '';
    });
    return labelsByKey;
}
/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelsSets) {
    return labelsSets.reduce(function (acc, labels) {
        if (!labels) {
            throw new Error('Need parsed labels to find common labels.');
        }
        if (!acc) {
            // Initial set
            acc = __assign({}, labels);
        }
        else {
            // Remove incoming labels that are missing or not matching in value
            Object.keys(labels).forEach(function (key) {
                if (acc[key] === undefined || acc[key] !== labels[key]) {
                    delete acc[key];
                }
            });
            // Remove common labels that are missing from incoming label set
            Object.keys(acc).forEach(function (key) {
                if (labels[key] === undefined) {
                    delete acc[key];
                }
            });
        }
        return acc;
    }, undefined);
}
/**
 * Returns a map of labels that are in `labels`, but not in `commonLabels`.
 */
export function findUniqueLabels(labels, commonLabels) {
    var uncommonLabels = __assign({}, labels);
    Object.keys(commonLabels).forEach(function (key) {
        delete uncommonLabels[key];
    });
    return uncommonLabels;
}
/**
 * Check that all labels exist in another set of labels
 */
export function matchAllLabels(expect, against) {
    var e_1, _a;
    if (!expect) {
        return true; // nothing to match
    }
    try {
        for (var _b = __values(Object.entries(expect)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
            if (!against || against[key] !== value) {
                return false;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return true;
}
/**
 * Serializes the given labels to a string.
 */
export function formatLabels(labels, defaultValue, withoutBraces) {
    if (defaultValue === void 0) { defaultValue = ''; }
    if (!labels || Object.keys(labels).length === 0) {
        return defaultValue;
    }
    var labelKeys = Object.keys(labels).sort();
    var cleanSelector = labelKeys.map(function (key) { return key + "=\"" + labels[key] + "\""; }).join(', ');
    if (withoutBraces) {
        return cleanSelector;
    }
    return ['{', cleanSelector, '}'].join('');
}
//# sourceMappingURL=labels.js.map