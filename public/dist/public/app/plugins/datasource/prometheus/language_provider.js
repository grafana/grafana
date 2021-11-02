import { __assign, __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
import { once, chain, difference } from 'lodash';
import LRU from 'lru-cache';
import { dateTime, LanguageProvider } from '@grafana/data';
import { SearchFunctionType } from '@grafana/ui';
import { addLimitInfo, fixSummariesMetadata, parseSelector, processHistogramMetrics, processLabels, roundSecToMin, } from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';
var DEFAULT_KEYS = ['job', 'instance'];
var EMPTY_SELECTOR = '{}';
var HISTORY_ITEM_COUNT = 5;
var HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export var SUGGESTIONS_LIMIT = 10000;
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
        var lastQueried = dateTime(recent.ts).fromNow();
        hint = hint + " Last queried " + lastQueried + ".";
    }
    return __assign(__assign({}, item), { documentation: hint });
}
function addMetricsMetadata(metric, metadata) {
    var item = { label: metric };
    if (metadata && metadata[metric]) {
        var _a = metadata[metric], type = _a.type, help = _a.help;
        item.documentation = type.toUpperCase() + ": " + help;
    }
    return item;
}
var PREFIX_DELIMITER_REGEX = /(="|!="|=~"|!~"|\{|\[|\(|\+|-|\/|\*|%|\^|\band\b|\bor\b|\bunless\b|==|>=|!=|<=|>|<|=|~|,)/;
var PromQlLanguageProvider = /** @class */ (function (_super) {
    __extends(PromQlLanguageProvider, _super);
    function PromQlLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        _this.labelKeys = [];
        /**
         *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
         *  not account for different size of a response. If that is needed a `length` function can be added in the options.
         *  10 as a max size is totally arbitrary right now.
         */
        _this.labelsCache = new LRU(10);
        _this.request = function (url, defaultValue, params) {
            if (params === void 0) { params = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var res, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.datasource.metadataRequest(url, params)];
                        case 1:
                            res = _a.sent();
                            return [2 /*return*/, res.data.data];
                        case 2:
                            error_1 = _a.sent();
                            console.error(error_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/, defaultValue];
                    }
                });
            });
        };
        _this.start = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (this.datasource.lookupsDisabled) {
                            return [2 /*return*/, []];
                        }
                        // TODO #33976: make those requests parallel
                        return [4 /*yield*/, this.fetchLabels()];
                    case 1:
                        // TODO #33976: make those requests parallel
                        _d.sent();
                        _a = this;
                        return [4 /*yield*/, this.fetchLabelValues('__name__')];
                    case 2:
                        _a.metrics = (_d.sent()) || [];
                        _b = this;
                        _c = fixSummariesMetadata;
                        return [4 /*yield*/, this.request('/api/v1/metadata', {})];
                    case 3:
                        _b.metricsMetadata = _c.apply(void 0, [_d.sent()]);
                        this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
                        return [2 /*return*/, []];
                }
            });
        }); };
        _this.provideCompletionItems = function (_a, context) {
            var prefix = _a.prefix, text = _a.text, value = _a.value, labelKey = _a.labelKey, wrapperClasses = _a.wrapperClasses;
            if (context === void 0) { context = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var emptyResult, empty, selectedLines, currentLine, nextCharacter, tokenRecognized, prefixUnrecognized, noSuffix, safePrefix, operatorsPattern, isNextOperand;
                return __generator(this, function (_b) {
                    emptyResult = { suggestions: [] };
                    if (!value) {
                        return [2 /*return*/, emptyResult];
                    }
                    empty = value.document.text.length === 0;
                    selectedLines = value.document.getTextsAtRange(value.selection);
                    currentLine = selectedLines.size === 1 ? selectedLines.first().getText() : null;
                    nextCharacter = currentLine ? currentLine[value.selection.anchor.offset] : null;
                    tokenRecognized = wrapperClasses.length > 3;
                    prefixUnrecognized = prefix && !tokenRecognized;
                    noSuffix = !nextCharacter || nextCharacter === ')';
                    safePrefix = prefix && !text.match(/^[\]})\s]+$/) && noSuffix;
                    operatorsPattern = /[+\-*/^%]/;
                    isNextOperand = text.match(operatorsPattern);
                    // Determine candidates by CSS context
                    if (wrapperClasses.includes('context-range')) {
                        // Suggestions for metric[|]
                        return [2 /*return*/, this.getRangeCompletionItems()];
                    }
                    else if (wrapperClasses.includes('context-labels')) {
                        // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
                        return [2 /*return*/, this.getLabelCompletionItems({ prefix: prefix, text: text, value: value, labelKey: labelKey, wrapperClasses: wrapperClasses })];
                    }
                    else if (wrapperClasses.includes('context-aggregation')) {
                        // Suggestions for sum(metric) by (|)
                        return [2 /*return*/, this.getAggregationCompletionItems(value)];
                    }
                    else if (empty) {
                        // Suggestions for empty query field
                        return [2 /*return*/, this.getEmptyCompletionItems(context)];
                    }
                    else if (prefixUnrecognized && noSuffix && !isNextOperand) {
                        // Show term suggestions in a couple of scenarios
                        return [2 /*return*/, this.getBeginningCompletionItems(context)];
                    }
                    else if (prefixUnrecognized && safePrefix) {
                        // Show term suggestions in a couple of scenarios
                        return [2 /*return*/, this.getTermCompletionItems()];
                    }
                    return [2 /*return*/, emptyResult];
                });
            });
        };
        _this.getBeginningCompletionItems = function (context) {
            return {
                suggestions: __spreadArray(__spreadArray([], __read(_this.getEmptyCompletionItems(context).suggestions), false), __read(_this.getTermCompletionItems().suggestions), false),
            };
        };
        _this.getEmptyCompletionItems = function (context) {
            var history = context.history;
            var suggestions = [];
            if (history && history.length) {
                var historyItems = chain(history)
                    .map(function (h) { return h.query.expr; })
                    .filter()
                    .uniq()
                    .take(HISTORY_ITEM_COUNT)
                    .map(wrapLabel)
                    .map(function (item) { return addHistoryMetadata(item, history); })
                    .value();
                suggestions.push({
                    searchFunctionType: SearchFunctionType.Prefix,
                    skipSort: true,
                    label: 'History',
                    items: historyItems,
                });
            }
            return { suggestions: suggestions };
        };
        _this.getTermCompletionItems = function () {
            var _a = _this, metrics = _a.metrics, metricsMetadata = _a.metricsMetadata;
            var suggestions = [];
            suggestions.push({
                searchFunctionType: SearchFunctionType.Prefix,
                label: 'Functions',
                items: FUNCTIONS.map(setFunctionKind),
            });
            if (metrics && metrics.length) {
                suggestions.push({
                    label: 'Metrics',
                    items: metrics.map(function (m) { return addMetricsMetadata(m, metricsMetadata); }),
                    searchFunctionType: SearchFunctionType.Fuzzy,
                });
            }
            return { suggestions: suggestions };
        };
        _this.getAggregationCompletionItems = function (value) { return __awaiter(_this, void 0, void 0, function () {
            var suggestions, queryOffset, queryText, openParensAggregationIndex, openParensSelectorIndex, closeParensSelectorIndex, closeParensAggregationIndex, result, selectorString, selector, series, labelKeys, limitInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        suggestions = [];
                        queryText = value.document.getBlocks().reduce(function (text, block) {
                            if (text === undefined) {
                                return '';
                            }
                            if (!block) {
                                return text;
                            }
                            var blockText = block === null || block === void 0 ? void 0 : block.getText();
                            if (value.anchorBlock.key === block.key) {
                                // Newline characters are not accounted for but this is irrelevant
                                // for the purpose of extracting the selector string
                                queryOffset = value.selection.anchor.offset + text.length;
                            }
                            return text + blockText;
                        }, '');
                        openParensAggregationIndex = queryText.lastIndexOf('(', queryOffset);
                        openParensSelectorIndex = queryText.lastIndexOf('(', openParensAggregationIndex - 1);
                        closeParensSelectorIndex = queryText.indexOf(')', openParensSelectorIndex);
                        // Try search for selector part of an alternate aggregation clause, such as `sum by (l) (m)`
                        if (openParensSelectorIndex === -1) {
                            closeParensAggregationIndex = queryText.indexOf(')', queryOffset);
                            closeParensSelectorIndex = queryText.indexOf(')', closeParensAggregationIndex + 1);
                            openParensSelectorIndex = queryText.lastIndexOf('(', closeParensSelectorIndex);
                        }
                        result = {
                            suggestions: suggestions,
                            context: 'context-aggregation',
                        };
                        // Suggestions are useless for alternative aggregation clauses without a selector in context
                        if (openParensSelectorIndex === -1) {
                            return [2 /*return*/, result];
                        }
                        selectorString = queryText
                            .slice(openParensSelectorIndex + 1, closeParensSelectorIndex)
                            .replace(/\[[^\]]+\]$/, '');
                        selector = parseSelector(selectorString, selectorString.length - 2).selector;
                        return [4 /*yield*/, this.getSeries(selector)];
                    case 1:
                        series = _a.sent();
                        labelKeys = Object.keys(series);
                        if (labelKeys.length > 0) {
                            limitInfo = addLimitInfo(labelKeys);
                            suggestions.push({
                                label: "Labels" + limitInfo,
                                items: labelKeys.map(wrapLabel),
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            });
                        }
                        return [2 /*return*/, result];
                }
            });
        }); };
        _this.getLabelCompletionItems = function (_a) {
            var text = _a.text, wrapperClasses = _a.wrapperClasses, labelKey = _a.labelKey, value = _a.value;
            return __awaiter(_this, void 0, void 0, function () {
                var suggestions, line, cursorOffset, suffix, prefix, isValueStart, isValueEnd, isPreValue, isValueEmpty, hasValuePrefix, selector, parsedSelector, containsMetric, existingKeys, series, context, limitInfo, labelKeys, possibleKeys, newItems, limitInfo, newSuggestion;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!value) {
                                return [2 /*return*/, { suggestions: [] }];
                            }
                            suggestions = [];
                            line = value.anchorBlock.getText();
                            cursorOffset = value.selection.anchor.offset;
                            suffix = line.substr(cursorOffset);
                            prefix = line.substr(0, cursorOffset);
                            isValueStart = text.match(/^(=|=~|!=|!~)/);
                            isValueEnd = suffix.match(/^"?[,}]|$/);
                            isPreValue = prefix.match(/(=|=~|!=|!~)$/) && suffix.match(/^"/);
                            isValueEmpty = isValueStart && isValueEnd;
                            hasValuePrefix = isValueEnd && !isValueStart;
                            if ((!isValueEmpty && !hasValuePrefix) || isPreValue) {
                                return [2 /*return*/, { suggestions: suggestions }];
                            }
                            try {
                                parsedSelector = parseSelector(line, cursorOffset);
                                selector = parsedSelector.selector;
                            }
                            catch (_c) {
                                selector = EMPTY_SELECTOR;
                            }
                            containsMetric = selector.includes('__name__=');
                            existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
                            series = {};
                            if (!selector) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.getSeries(selector, !containsMetric)];
                        case 1:
                            series = _b.sent();
                            _b.label = 2;
                        case 2:
                            if (Object.keys(series).length === 0) {
                                console.warn("Server did not return any values for selector = " + selector);
                                return [2 /*return*/, { suggestions: suggestions }];
                            }
                            if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
                                // Label values
                                if (labelKey && series[labelKey]) {
                                    context = 'context-label-values';
                                    limitInfo = addLimitInfo(series[labelKey]);
                                    suggestions.push({
                                        label: "Label values for \"" + labelKey + "\"" + limitInfo,
                                        items: series[labelKey].map(wrapLabel),
                                        searchFunctionType: SearchFunctionType.Fuzzy,
                                    });
                                }
                            }
                            else {
                                labelKeys = series ? Object.keys(series) : containsMetric ? null : DEFAULT_KEYS;
                                if (labelKeys) {
                                    possibleKeys = difference(labelKeys, existingKeys);
                                    if (possibleKeys.length) {
                                        context = 'context-labels';
                                        newItems = possibleKeys.map(function (key) { return ({ label: key }); });
                                        limitInfo = addLimitInfo(newItems);
                                        newSuggestion = {
                                            label: "Labels" + limitInfo,
                                            items: newItems,
                                            searchFunctionType: SearchFunctionType.Fuzzy,
                                        };
                                        suggestions.push(newSuggestion);
                                    }
                                }
                            }
                            return [2 /*return*/, { context: context, suggestions: suggestions }];
                    }
                });
            });
        };
        _this.fetchLabelValues = function (key) { return __awaiter(_this, void 0, void 0, function () {
            var params, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = this.datasource.getTimeRangeParams();
                        url = "/api/v1/label/" + key + "/values";
                        return [4 /*yield*/, this.request(url, [], params)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); };
        /**
         * Fetch labels for a series. This is cached by it's args but also by the global timeRange currently selected as
         * they can change over requested time.
         * @param name
         * @param withName
         */
        _this.fetchSeriesLabels = function (name, withName) { return __awaiter(_this, void 0, void 0, function () {
            var range, urlParams, url, cacheParams, cacheKey, value, data, values;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        range = this.datasource.getTimeRangeParams();
                        urlParams = __assign(__assign({}, range), { 'match[]': name });
                        url = "/api/v1/series";
                        cacheParams = new URLSearchParams({
                            'match[]': name,
                            start: roundSecToMin(parseInt(range.start, 10)).toString(),
                            end: roundSecToMin(parseInt(range.end, 10)).toString(),
                            withName: withName ? 'true' : 'false',
                        });
                        cacheKey = "/api/v1/series?" + cacheParams.toString();
                        value = this.labelsCache.get(cacheKey);
                        if (!!value) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.request(url, [], urlParams)];
                    case 1:
                        data = _a.sent();
                        values = processLabels(data, withName).values;
                        value = values;
                        this.labelsCache.set(cacheKey, value);
                        _a.label = 2;
                    case 2: return [2 /*return*/, value];
                }
            });
        }); };
        /**
         * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
         * @param match
         */
        _this.fetchSeries = function (match) { return __awaiter(_this, void 0, void 0, function () {
            var url, range, params;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = '/api/v1/series';
                        range = this.datasource.getTimeRangeParams();
                        params = __assign(__assign({}, range), { 'match[]': match });
                        return [4 /*yield*/, this.request(url, {}, params)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); };
        /**
         * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
         * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
         * fetchSeriesLabels.
         */
        _this.fetchDefaultSeries = once(function () { return __awaiter(_this, void 0, void 0, function () {
            var values;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(DEFAULT_KEYS.map(function (key) { return _this.fetchLabelValues(key); }))];
                    case 1:
                        values = _a.sent();
                        return [2 /*return*/, DEFAULT_KEYS.reduce(function (acc, key, i) {
                                var _a;
                                return (__assign(__assign({}, acc), (_a = {}, _a[key] = values[i], _a)));
                            }, {})];
                }
            });
        }); });
        _this.datasource = datasource;
        _this.histogramMetrics = [];
        _this.timeRange = { start: 0, end: 0 };
        _this.metrics = [];
        Object.assign(_this, initialValues);
        return _this;
    }
    // Strip syntax chars so that typeahead suggestions can work on clean inputs
    PromQlLanguageProvider.prototype.cleanText = function (s) {
        var parts = s.split(PREFIX_DELIMITER_REGEX);
        var last = parts.pop();
        return last.trimLeft().replace(/"$/, '').replace(/^"/, '');
    };
    Object.defineProperty(PromQlLanguageProvider.prototype, "syntax", {
        get: function () {
            return PromqlSyntax;
        },
        enumerable: false,
        configurable: true
    });
    PromQlLanguageProvider.prototype.getLabelKeys = function () {
        return this.labelKeys;
    };
    PromQlLanguageProvider.prototype.getRangeCompletionItems = function () {
        return {
            context: 'context-range',
            suggestions: [
                {
                    label: 'Range vector',
                    items: __spreadArray([], __read(RATE_RANGES), false),
                },
            ],
        };
    };
    PromQlLanguageProvider.prototype.getSeries = function (selector, withName) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.datasource.lookupsDisabled) {
                            return [2 /*return*/, {}];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        if (!(selector === EMPTY_SELECTOR)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.fetchDefaultSeries()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [4 /*yield*/, this.fetchSeriesLabels(selector, withName)];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        // TODO: better error handling
                        console.error(error_2);
                        return [2 /*return*/, {}];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    PromQlLanguageProvider.prototype.getLabelValues = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchLabelValues(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Fetches all label keys
     */
    PromQlLanguageProvider.prototype.fetchLabels = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, params, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = '/api/v1/labels';
                        params = this.datasource.getTimeRangeParams();
                        this.labelFetchTs = Date.now().valueOf();
                        return [4 /*yield*/, this.request(url, [], params)];
                    case 1:
                        res = _a.sent();
                        if (Array.isArray(res)) {
                            this.labelKeys = res.slice().sort();
                        }
                        return [2 /*return*/, []];
                }
            });
        });
    };
    return PromQlLanguageProvider;
}(LanguageProvider));
export default PromQlLanguageProvider;
//# sourceMappingURL=language_provider.js.map