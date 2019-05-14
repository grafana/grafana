import * as tslib_1 from "tslib";
import _ from 'lodash';
import moment from 'moment';
import { LanguageProvider, } from 'app/types/explore';
import { parseSelector, processLabels } from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';
var DEFAULT_KEYS = ['job', 'instance'];
var EMPTY_SELECTOR = '{}';
var HISTOGRAM_SELECTOR = '{le!=""}'; // Returns all timeseries for histograms
var HISTORY_ITEM_COUNT = 5;
var HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
var wrapLabel = function (label) { return ({ label: label }); };
var setFunctionKind = function (suggestion) {
    suggestion.kind = 'function';
    return suggestion;
};
export function addHistoryMetadata(item, history) {
    var cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
    var historyForItem = history.filter(function (h) { return h.ts > cutoffTs && h.query === item.label; });
    var count = historyForItem.length;
    var recent = historyForItem[0];
    var hint = "Queried " + count + " times in the last 24h.";
    if (recent) {
        var lastQueried = moment(recent.ts).fromNow();
        hint = hint + " Last queried " + lastQueried + ".";
    }
    return tslib_1.__assign({}, item, { documentation: hint });
}
var PromQlLanguageProvider = /** @class */ (function (_super) {
    tslib_1.__extends(PromQlLanguageProvider, _super);
    function PromQlLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        // Strip syntax chars
        _this.cleanText = function (s) { return s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim(); };
        _this.request = function (url) {
            return _this.datasource.metadataRequest(url);
        };
        _this.start = function () {
            if (!_this.startTask) {
                _this.startTask = _this.fetchMetricNames().then(function () { return [_this.fetchHistogramMetrics()]; });
            }
            return _this.startTask;
        };
        _this.datasource = datasource;
        _this.histogramMetrics = [];
        _this.labelKeys = {};
        _this.labelValues = {};
        _this.metrics = [];
        Object.assign(_this, initialValues);
        return _this;
    }
    PromQlLanguageProvider.prototype.getSyntax = function () {
        return PromqlSyntax;
    };
    // Keep this DOM-free for testing
    PromQlLanguageProvider.prototype.provideCompletionItems = function (_a, context) {
        var prefix = _a.prefix, wrapperClasses = _a.wrapperClasses, text = _a.text, value = _a.value;
        // Local text properties
        var empty = value.document.text.length === 0;
        var selectedLines = value.document.getTextsAtRangeAsArray(value.selection);
        var currentLine = selectedLines.length === 1 ? selectedLines[0] : null;
        var nextCharacter = currentLine ? currentLine.text[value.selection.anchorOffset] : null;
        // Syntax spans have 3 classes by default. More indicate a recognized token
        var tokenRecognized = wrapperClasses.length > 3;
        // Non-empty prefix, but not inside known token
        var prefixUnrecognized = prefix && !tokenRecognized;
        // Prevent suggestions in `function(|suffix)`
        var noSuffix = !nextCharacter || nextCharacter === ')';
        // Empty prefix is safe if it does not immediately folllow a complete expression and has no text after it
        var safeEmptyPrefix = prefix === '' && !text.match(/^[\]})\s]+$/) && noSuffix;
        // About to type next operand if preceded by binary operator
        var isNextOperand = text.match(/[+\-*/^%]/);
        // Determine candidates by CSS context
        if (_.includes(wrapperClasses, 'context-range')) {
            // Suggestions for metric[|]
            return this.getRangeCompletionItems();
        }
        else if (_.includes(wrapperClasses, 'context-labels')) {
            // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
            return this.getLabelCompletionItems.apply(this, arguments);
        }
        else if (_.includes(wrapperClasses, 'context-aggregation')) {
            // Suggestions for sum(metric) by (|)
            return this.getAggregationCompletionItems.apply(this, arguments);
        }
        else if (empty) {
            // Suggestions for empty query field
            return this.getEmptyCompletionItems(context || {});
        }
        else if (prefixUnrecognized || safeEmptyPrefix || isNextOperand) {
            // Show term suggestions in a couple of scenarios
            return this.getTermCompletionItems();
        }
        return {
            suggestions: [],
        };
    };
    PromQlLanguageProvider.prototype.getEmptyCompletionItems = function (context) {
        var history = context.history;
        var suggestions = [];
        if (history && history.length > 0) {
            var historyItems = _.chain(history)
                .map(function (h) { return h.query.expr; })
                .filter()
                .uniq()
                .take(HISTORY_ITEM_COUNT)
                .map(wrapLabel)
                .map(function (item) { return addHistoryMetadata(item, history); })
                .value();
            suggestions.push({
                prefixMatch: true,
                skipSort: true,
                label: 'History',
                items: historyItems,
            });
        }
        var termCompletionItems = this.getTermCompletionItems();
        suggestions = tslib_1.__spread(suggestions, termCompletionItems.suggestions);
        return { suggestions: suggestions };
    };
    PromQlLanguageProvider.prototype.getTermCompletionItems = function () {
        var metrics = this.metrics;
        var suggestions = [];
        suggestions.push({
            prefixMatch: true,
            label: 'Functions',
            items: FUNCTIONS.map(setFunctionKind),
        });
        if (metrics && metrics.length > 0) {
            suggestions.push({
                label: 'Metrics',
                items: metrics.map(wrapLabel),
            });
        }
        return { suggestions: suggestions };
    };
    PromQlLanguageProvider.prototype.getRangeCompletionItems = function () {
        return {
            context: 'context-range',
            suggestions: [
                {
                    label: 'Range vector',
                    items: tslib_1.__spread(RATE_RANGES),
                },
            ],
        };
    };
    PromQlLanguageProvider.prototype.getAggregationCompletionItems = function (_a) {
        var value = _a.value;
        var refresher = null;
        var suggestions = [];
        // Stitch all query lines together to support multi-line queries
        var queryOffset;
        var queryText = value.document.getBlocks().reduce(function (text, block) {
            var blockText = block.getText();
            if (value.anchorBlock.key === block.key) {
                // Newline characters are not accounted for but this is irrelevant
                // for the purpose of extracting the selector string
                queryOffset = value.anchorOffset + text.length;
            }
            text += blockText;
            return text;
        }, '');
        // Try search for selector part on the left-hand side, such as `sum (m) by (l)`
        var openParensAggregationIndex = queryText.lastIndexOf('(', queryOffset);
        var openParensSelectorIndex = queryText.lastIndexOf('(', openParensAggregationIndex - 1);
        var closeParensSelectorIndex = queryText.indexOf(')', openParensSelectorIndex);
        // Try search for selector part of an alternate aggregation clause, such as `sum by (l) (m)`
        if (openParensSelectorIndex === -1) {
            var closeParensAggregationIndex = queryText.indexOf(')', queryOffset);
            closeParensSelectorIndex = queryText.indexOf(')', closeParensAggregationIndex + 1);
            openParensSelectorIndex = queryText.lastIndexOf('(', closeParensSelectorIndex);
        }
        var result = {
            refresher: refresher,
            suggestions: suggestions,
            context: 'context-aggregation',
        };
        // Suggestions are useless for alternative aggregation clauses without a selector in context
        if (openParensSelectorIndex === -1) {
            return result;
        }
        var selectorString = queryText.slice(openParensSelectorIndex + 1, closeParensSelectorIndex);
        // Range vector syntax not accounted for by subsequent parse so discard it if present
        selectorString = selectorString.replace(/\[[^\]]+\]$/, '');
        var selector = parseSelector(selectorString, selectorString.length - 2).selector;
        var labelKeys = this.labelKeys[selector];
        if (labelKeys) {
            suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
        }
        else {
            result.refresher = this.fetchSeriesLabels(selector);
        }
        return result;
    };
    PromQlLanguageProvider.prototype.getLabelCompletionItems = function (_a) {
        var _this = this;
        var text = _a.text, wrapperClasses = _a.wrapperClasses, labelKey = _a.labelKey, value = _a.value;
        var context;
        var refresher = null;
        var suggestions = [];
        var line = value.anchorBlock.getText();
        var cursorOffset = value.anchorOffset;
        // Get normalized selector
        var selector;
        var parsedSelector;
        try {
            parsedSelector = parseSelector(line, cursorOffset);
            selector = parsedSelector.selector;
        }
        catch (_b) {
            selector = EMPTY_SELECTOR;
        }
        var containsMetric = selector.indexOf('__name__=') > -1;
        var existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
        if ((text && text.match(/^!?=~?/)) || _.includes(wrapperClasses, 'attr-value')) {
            // Label values
            if (labelKey && this.labelValues[selector] && this.labelValues[selector][labelKey]) {
                var labelValues = this.labelValues[selector][labelKey];
                context = 'context-label-values';
                suggestions.push({
                    label: "Label values for \"" + labelKey + "\"",
                    items: labelValues.map(wrapLabel),
                });
            }
        }
        else {
            // Label keys
            var labelKeys = this.labelKeys[selector] || (containsMetric ? null : DEFAULT_KEYS);
            if (labelKeys) {
                var possibleKeys = _.difference(labelKeys, existingKeys);
                if (possibleKeys.length > 0) {
                    context = 'context-labels';
                    suggestions.push({ label: "Labels", items: possibleKeys.map(wrapLabel) });
                }
            }
        }
        // Query labels for selector
        if (selector && !this.labelValues[selector]) {
            if (selector === EMPTY_SELECTOR) {
                // Query label values for default labels
                refresher = Promise.all(DEFAULT_KEYS.map(function (key) { return _this.fetchLabelValues(key); }));
            }
            else {
                refresher = this.fetchSeriesLabels(selector, !containsMetric);
            }
        }
        return { context: context, refresher: refresher, suggestions: suggestions };
    };
    PromQlLanguageProvider.prototype.fetchMetricNames = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var url, res, body, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = '/api/v1/label/__name__/values';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.request(url)];
                    case 2:
                        res = _a.sent();
                        return [4 /*yield*/, (res.data || res.json())];
                    case 3:
                        body = _a.sent();
                        this.metrics = body.data;
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error(error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PromQlLanguageProvider.prototype.fetchHistogramMetrics = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var histogramSeries;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchSeriesLabels(HISTOGRAM_SELECTOR, true)];
                    case 1:
                        _a.sent();
                        histogramSeries = this.labelValues[HISTOGRAM_SELECTOR];
                        if (histogramSeries && histogramSeries['__name__']) {
                            this.histogramMetrics = histogramSeries['__name__'].slice().sort();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    PromQlLanguageProvider.prototype.fetchLabelValues = function (key) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, _b, url, res, body, exisingValues, values, e_1;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        url = "/api/v1/label/" + key + "/values";
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.request(url)];
                    case 2:
                        res = _c.sent();
                        return [4 /*yield*/, (res.data || res.json())];
                    case 3:
                        body = _c.sent();
                        exisingValues = this.labelValues[EMPTY_SELECTOR];
                        values = tslib_1.__assign({}, exisingValues, (_a = {}, _a[key] = body.data, _a));
                        this.labelValues = tslib_1.__assign({}, this.labelValues, (_b = {}, _b[EMPTY_SELECTOR] = values, _b));
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _c.sent();
                        console.error(e_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PromQlLanguageProvider.prototype.fetchSeriesLabels = function (name, withName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, _b, url, res, body, _c, keys, values, e_2;
            return tslib_1.__generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        url = "/api/v1/series?match[]=" + name;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.request(url)];
                    case 2:
                        res = _d.sent();
                        return [4 /*yield*/, (res.data || res.json())];
                    case 3:
                        body = _d.sent();
                        _c = processLabels(body.data, withName), keys = _c.keys, values = _c.values;
                        this.labelKeys = tslib_1.__assign({}, this.labelKeys, (_a = {}, _a[name] = keys, _a));
                        this.labelValues = tslib_1.__assign({}, this.labelValues, (_b = {}, _b[name] = values, _b));
                        return [3 /*break*/, 5];
                    case 4:
                        e_2 = _d.sent();
                        console.error(e_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return PromQlLanguageProvider;
}(LanguageProvider));
export default PromQlLanguageProvider;
//# sourceMappingURL=language_provider.js.map