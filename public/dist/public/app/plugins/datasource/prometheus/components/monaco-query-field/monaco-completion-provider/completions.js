import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import { NeverCaseError } from './util';
// FIXME: we should not load this from the "outside", but we cannot do that while we have the "old" query-field too
import { FUNCTIONS } from '../../../promql';
// we order items like: history, functions, metrics
function getAllMetricNamesCompletions(dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        var metrics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dataProvider.getAllMetricNames()];
                case 1:
                    metrics = _a.sent();
                    return [2 /*return*/, metrics.map(function (metric) { return ({
                            type: 'METRIC_NAME',
                            label: metric.name,
                            insertText: metric.name,
                            detail: metric.name + " : " + metric.type,
                            documentation: metric.help,
                        }); })];
            }
        });
    });
}
var FUNCTION_COMPLETIONS = FUNCTIONS.map(function (f) {
    var _a;
    return ({
        type: 'FUNCTION',
        label: f.label,
        insertText: (_a = f.insertText) !== null && _a !== void 0 ? _a : '',
        detail: f.detail,
        documentation: f.documentation,
    });
});
var DURATION_COMPLETIONS = [
    '$__interval',
    '$__range',
    '$__rate_interval',
    '1m',
    '5m',
    '10m',
    '30m',
    '1h',
    '1d',
].map(function (text) { return ({
    type: 'DURATION',
    label: text,
    insertText: text,
}); });
function getAllHistoryCompletions(dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        var allHistory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dataProvider.getHistory()];
                case 1:
                    allHistory = _a.sent();
                    // FIXME: find a better history-limit
                    return [2 /*return*/, allHistory.slice(0, 10).map(function (expr) { return ({
                            type: 'HISTORY',
                            label: expr,
                            insertText: expr,
                        }); })];
            }
        });
    });
}
function makeSelector(metricName, labels) {
    var allLabels = __spreadArray([], __read(labels), false);
    // we transform the metricName to a label, if it exists
    if (metricName !== undefined) {
        allLabels.push({ name: '__name__', value: metricName, op: '=' });
    }
    var allLabelTexts = allLabels.map(function (label) { return "" + label.name + label.op + "\"" + label.value + "\""; });
    return "{" + allLabelTexts.join(',') + "}";
}
function getLabelNamesForCompletions(metric, suffix, triggerOnInsert, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        var selector, data, possibleLabelNames, usedLabelNames, labelNames;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    selector = makeSelector(metric, otherLabels);
                    return [4 /*yield*/, dataProvider.getSeries(selector)];
                case 1:
                    data = _a.sent();
                    possibleLabelNames = Object.keys(data);
                    usedLabelNames = new Set(otherLabels.map(function (l) { return l.name; }));
                    labelNames = possibleLabelNames.filter(function (l) { return !usedLabelNames.has(l); });
                    return [2 /*return*/, labelNames.map(function (text) { return ({
                            type: 'LABEL_NAME',
                            label: text,
                            insertText: "" + text + suffix,
                            triggerOnInsert: triggerOnInsert,
                        }); })];
            }
        });
    });
}
function getLabelNamesForSelectorCompletions(metric, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getLabelNamesForCompletions(metric, '=', true, otherLabels, dataProvider)];
        });
    });
}
function getLabelNamesForByCompletions(metric, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getLabelNamesForCompletions(metric, '', false, otherLabels, dataProvider)];
        });
    });
}
function getLabelValuesForMetricCompletions(metric, labelName, otherLabels, dataProvider) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var selector, data, values;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    selector = makeSelector(metric, otherLabels);
                    return [4 /*yield*/, dataProvider.getSeries(selector)];
                case 1:
                    data = _b.sent();
                    values = (_a = data[labelName]) !== null && _a !== void 0 ? _a : [];
                    return [2 /*return*/, values.map(function (text) { return ({
                            type: 'LABEL_VALUE',
                            label: text,
                            insertText: "\"" + text + "\"", // FIXME: escaping strange characters?
                        }); })];
            }
        });
    });
}
export function getCompletions(intent, dataProvider) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, metricNames, metricNames, historyCompletions;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = intent.type;
                    switch (_a) {
                        case 'ALL_DURATIONS': return [3 /*break*/, 1];
                        case 'ALL_METRIC_NAMES': return [3 /*break*/, 2];
                        case 'FUNCTIONS_AND_ALL_METRIC_NAMES': return [3 /*break*/, 3];
                        case 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES': return [3 /*break*/, 5];
                        case 'LABEL_NAMES_FOR_SELECTOR': return [3 /*break*/, 8];
                        case 'LABEL_NAMES_FOR_BY': return [3 /*break*/, 9];
                        case 'LABEL_VALUES': return [3 /*break*/, 10];
                    }
                    return [3 /*break*/, 11];
                case 1: return [2 /*return*/, DURATION_COMPLETIONS];
                case 2: return [2 /*return*/, getAllMetricNamesCompletions(dataProvider)];
                case 3: return [4 /*yield*/, getAllMetricNamesCompletions(dataProvider)];
                case 4:
                    metricNames = _b.sent();
                    return [2 /*return*/, __spreadArray(__spreadArray([], __read(FUNCTION_COMPLETIONS), false), __read(metricNames), false)];
                case 5: return [4 /*yield*/, getAllMetricNamesCompletions(dataProvider)];
                case 6:
                    metricNames = _b.sent();
                    return [4 /*yield*/, getAllHistoryCompletions(dataProvider)];
                case 7:
                    historyCompletions = _b.sent();
                    return [2 /*return*/, __spreadArray(__spreadArray(__spreadArray([], __read(historyCompletions), false), __read(FUNCTION_COMPLETIONS), false), __read(metricNames), false)];
                case 8: return [2 /*return*/, getLabelNamesForSelectorCompletions(intent.metricName, intent.otherLabels, dataProvider)];
                case 9: return [2 /*return*/, getLabelNamesForByCompletions(intent.metricName, intent.otherLabels, dataProvider)];
                case 10: return [2 /*return*/, getLabelValuesForMetricCompletions(intent.metricName, intent.labelName, intent.otherLabels, dataProvider)];
                case 11: throw new NeverCaseError(intent);
            }
        });
    });
}
//# sourceMappingURL=completions.js.map