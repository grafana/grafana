import { __assign, __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
// Libraries
import { chain, difference } from 'lodash';
import LRU from 'lru-cache';
// Services & Utils
import { parseSelector, labelRegexp, selectorRegexp, processLabels, } from 'app/plugins/datasource/prometheus/language_utils';
import syntax, { FUNCTIONS, PIPE_PARSERS, PIPE_OPERATORS } from './syntax';
import { dateTime, LanguageProvider } from '@grafana/data';
import fromGraphite from './importing/fromGraphite';
var DEFAULT_KEYS = ['job', 'namespace'];
var EMPTY_SELECTOR = '{}';
var HISTORY_ITEM_COUNT = 10;
var HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
var NS_IN_MS = 1000000;
// When changing RATE_RANGES, check if Prometheus/PromQL ranges should be changed too
// @see public/app/plugins/datasource/prometheus/promql.ts
var RATE_RANGES = [
    { label: '$__interval', sortValue: '$__interval' },
    { label: '$__range', sortValue: '$__range' },
    { label: '1m', sortValue: '00:01:00' },
    { label: '5m', sortValue: '00:05:00' },
    { label: '10m', sortValue: '00:10:00' },
    { label: '30m', sortValue: '00:30:00' },
    { label: '1h', sortValue: '01:00:00' },
    { label: '1d', sortValue: '24:00:00' },
];
export var LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec
var wrapLabel = function (label) { return ({ label: label, filterText: "\"" + label + "\"" }); };
export function addHistoryMetadata(item, history) {
    var cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
    var historyForItem = history.filter(function (h) { return h.ts > cutoffTs && h.query.expr === item.label; });
    var hint = "Queried " + historyForItem.length + " times in the last 24h.";
    var recent = historyForItem[0];
    if (recent) {
        var lastQueried = dateTime(recent.ts).fromNow();
        hint = hint + " Last queried " + lastQueried + ".";
    }
    return __assign(__assign({}, item), { documentation: hint });
}
var LokiLanguageProvider = /** @class */ (function (_super) {
    __extends(LokiLanguageProvider, _super);
    function LokiLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        _this.started = false;
        _this.lookupsDisabled = false; // Dynamically set to true for big/slow instances
        /**
         *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
         *  not account for different size of a response. If that is needed a `length` function can be added in the options.
         *  10 as a max size is totally arbitrary right now.
         */
        _this.seriesCache = new LRU(10);
        _this.labelsCache = new LRU(10);
        // Strip syntax chars
        _this.cleanText = function (s) { return s.replace(/[{}[\]="(),!~+\-*/^%\|]/g, '').trim(); };
        _this.request = function (url, params) { return __awaiter(_this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.datasource.metadataRequest(url, params)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        console.error(error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, undefined];
                }
            });
        }); };
        /**
         * Initialise the language provider by fetching set of labels. Without this initialisation the provider would return
         * just a set of hardcoded default labels on provideCompletionItems or a recent queries from history.
         */
        _this.start = function () {
            if (!_this.startTask) {
                _this.startTask = _this.fetchLabels().then(function () {
                    _this.started = true;
                    return [];
                });
            }
            return _this.startTask;
        };
        _this.getBeginningCompletionItems = function (context) {
            return {
                suggestions: __spreadArray(__spreadArray([], __read(_this.getEmptyCompletionItems(context).suggestions), false), __read(_this.getTermCompletionItems().suggestions), false),
            };
        };
        _this.getTermCompletionItems = function () {
            var suggestions = [];
            suggestions.push({
                prefixMatch: true,
                label: 'Functions',
                items: FUNCTIONS.map(function (suggestion) { return (__assign(__assign({}, suggestion), { kind: 'function' })); }),
            });
            return { suggestions: suggestions };
        };
        _this.getPipeCompletionItem = function () {
            var suggestions = [];
            suggestions.push({
                label: 'Operators',
                items: PIPE_OPERATORS.map(function (suggestion) { return (__assign(__assign({}, suggestion), { kind: 'operators' })); }),
            });
            suggestions.push({
                label: 'Parsers',
                items: PIPE_PARSERS.map(function (suggestion) { return (__assign(__assign({}, suggestion), { kind: 'parsers' })); }),
            });
            return { suggestions: suggestions };
        };
        /**
         * Fetch labels for a selector. This is cached by it's args but also by the global timeRange currently selected as
         * they can change over requested time.
         * @param name
         */
        _this.fetchSeriesLabels = function (match) { return __awaiter(_this, void 0, void 0, function () {
            var url, _a, start, end, cacheKey, value, params, data, values;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = '/loki/api/v1/series';
                        _a = this.datasource.getTimeRangeParams(), start = _a.start, end = _a.end;
                        cacheKey = this.generateCacheKey(url, start, end, match);
                        value = this.seriesCache.get(cacheKey);
                        if (!!value) return [3 /*break*/, 2];
                        // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
                        this.seriesCache.set(cacheKey, {});
                        params = { 'match[]': match, start: start, end: end };
                        return [4 /*yield*/, this.request(url, params)];
                    case 1:
                        data = _b.sent();
                        values = processLabels(data).values;
                        value = values;
                        this.seriesCache.set(cacheKey, value);
                        _b.label = 2;
                    case 2: return [2 /*return*/, value];
                }
            });
        }); };
        /**
         * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
         * @param match
         */
        _this.fetchSeries = function (match) { return __awaiter(_this, void 0, void 0, function () {
            var url, _a, start, end, params;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = '/loki/api/v1/series';
                        _a = this.datasource.getTimeRangeParams(), start = _a.start, end = _a.end;
                        params = { 'match[]': match, start: start, end: end };
                        return [4 /*yield*/, this.request(url, params)];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        }); };
        _this.datasource = datasource;
        _this.labelKeys = [];
        _this.labelFetchTs = 0;
        Object.assign(_this, initialValues);
        return _this;
    }
    LokiLanguageProvider.prototype.getSyntax = function () {
        return syntax;
    };
    LokiLanguageProvider.prototype.getLabelKeys = function () {
        return this.labelKeys;
    };
    /**
     * Return suggestions based on input that can be then plugged into a typeahead dropdown.
     * Keep this DOM-free for testing
     * @param input
     * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
     * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
     * @param context.history Optional used only in getEmptyCompletionItems
     */
    LokiLanguageProvider.prototype.provideCompletionItems = function (input, context) {
        return __awaiter(this, void 0, void 0, function () {
            var wrapperClasses, value, prefix, text, emptyResult, empty, selectedLines, currentLine, nextCharacter, tokenRecognized, prefixUnrecognized, noSuffix, safePrefix, operatorsPattern, isNextOperand;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapperClasses = input.wrapperClasses, value = input.value, prefix = input.prefix, text = input.text;
                        emptyResult = { suggestions: [] };
                        if (!value) {
                            return [2 /*return*/, emptyResult];
                        }
                        empty = (value === null || value === void 0 ? void 0 : value.document.text.length) === 0;
                        selectedLines = value.document.getTextsAtRange(value.selection);
                        currentLine = selectedLines.size === 1 ? selectedLines.first().getText() : null;
                        nextCharacter = currentLine ? currentLine[value.selection.anchor.offset] : null;
                        tokenRecognized = wrapperClasses.length > 3;
                        prefixUnrecognized = prefix && !tokenRecognized;
                        noSuffix = !nextCharacter || nextCharacter === ')';
                        safePrefix = prefix && !text.match(/^['"~=\]})\s]+$/) && noSuffix;
                        operatorsPattern = /[+\-*/^%]/;
                        isNextOperand = text.match(operatorsPattern);
                        if (!wrapperClasses.includes('context-range')) return [3 /*break*/, 1];
                        // Suggestions for metric[|]
                        return [2 /*return*/, this.getRangeCompletionItems()];
                    case 1:
                        if (!wrapperClasses.includes('context-labels')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getLabelCompletionItems(input)];
                    case 2: 
                    // Suggestions for {|} and {foo=|}
                    return [2 /*return*/, _a.sent()];
                    case 3:
                        if (wrapperClasses.includes('context-pipe')) {
                            return [2 /*return*/, this.getPipeCompletionItem()];
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
                        _a.label = 4;
                    case 4: return [2 /*return*/, emptyResult];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.getEmptyCompletionItems = function (context) {
        var history = context === null || context === void 0 ? void 0 : context.history;
        var suggestions = [];
        if (history === null || history === void 0 ? void 0 : history.length) {
            var historyItems = chain(history)
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
        return { suggestions: suggestions };
    };
    LokiLanguageProvider.prototype.getRangeCompletionItems = function () {
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
    LokiLanguageProvider.prototype.getLabelCompletionItems = function (_a) {
        var text = _a.text, wrapperClasses = _a.wrapperClasses, labelKey = _a.labelKey, value = _a.value;
        return __awaiter(this, void 0, void 0, function () {
            var context, suggestions, line, cursorOffset, isValueStart, selector, parsedSelector, allLabels, existingKeys, labelValues, labelValuesForKey, labelKeys, possibleKeys, newItems, newSuggestion;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        context = 'context-labels';
                        suggestions = [];
                        if (!value) {
                            return [2 /*return*/, { context: context, suggestions: [] }];
                        }
                        line = value.anchorBlock.getText();
                        cursorOffset = value.selection.anchor.offset;
                        isValueStart = text.match(/^(=|=~|!=|!~)/);
                        try {
                            parsedSelector = parseSelector(line, cursorOffset);
                            selector = parsedSelector.selector;
                        }
                        catch (_d) {
                            selector = EMPTY_SELECTOR;
                        }
                        if (!(!labelKey && selector === EMPTY_SELECTOR)) return [3 /*break*/, 2];
                        // start task gets all labels
                        return [4 /*yield*/, this.start()];
                    case 1:
                        // start task gets all labels
                        _c.sent();
                        allLabels = this.getLabelKeys();
                        return [2 /*return*/, { context: context, suggestions: [{ label: "Labels", items: allLabels.map(wrapLabel) }] }];
                    case 2:
                        existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
                        if (!selector) return [3 /*break*/, 6];
                        if (!(selector === EMPTY_SELECTOR && labelKey)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getLabelValues(labelKey)];
                    case 3:
                        labelValuesForKey = _c.sent();
                        labelValues = (_b = {}, _b[labelKey] = labelValuesForKey, _b);
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.getSeriesLabels(selector)];
                    case 5:
                        labelValues = _c.sent();
                        _c.label = 6;
                    case 6:
                        if (!labelValues) {
                            console.warn("Server did not return any values for selector = " + selector);
                            return [2 /*return*/, { context: context, suggestions: suggestions }];
                        }
                        if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
                            // Label values
                            if (labelKey && labelValues[labelKey]) {
                                context = 'context-label-values';
                                suggestions.push({
                                    label: "Label values for \"" + labelKey + "\"",
                                    // Filter to prevent previously selected values from being repeatedly suggested
                                    items: labelValues[labelKey].map(wrapLabel).filter(function (_a) {
                                        var filterText = _a.filterText;
                                        return filterText !== text;
                                    }),
                                });
                            }
                        }
                        else {
                            labelKeys = labelValues ? Object.keys(labelValues) : DEFAULT_KEYS;
                            if (labelKeys) {
                                possibleKeys = difference(labelKeys, existingKeys);
                                if (possibleKeys.length) {
                                    newItems = possibleKeys.map(function (key) { return ({ label: key }); });
                                    newSuggestion = { label: "Labels", items: newItems };
                                    suggestions.push(newSuggestion);
                                }
                            }
                        }
                        return [2 /*return*/, { context: context, suggestions: suggestions }];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.importQueries = function (queries, originDataSource) {
        return __awaiter(this, void 0, void 0, function () {
            var datasourceType;
            var _this = this;
            return __generator(this, function (_a) {
                datasourceType = originDataSource.meta.id;
                if (datasourceType === 'prometheus') {
                    return [2 /*return*/, Promise.all(__spreadArray([], __read(queries), false).map(function (query) { return __awaiter(_this, void 0, void 0, function () {
                            var expr, refId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.importPrometheusQuery(query.expr)];
                                    case 1:
                                        expr = _a.sent();
                                        refId = query.refId;
                                        return [2 /*return*/, {
                                                expr: expr,
                                                refId: refId,
                                                range: true,
                                            }];
                                }
                            });
                        }); }))];
                }
                if (datasourceType === 'graphite') {
                    return [2 /*return*/, fromGraphite(queries, originDataSource)];
                }
                // Return a cleaned LokiQuery
                return [2 /*return*/, queries.map(function (query) { return ({
                        refId: query.refId,
                        expr: '',
                    }); })];
            });
        });
    };
    LokiLanguageProvider.prototype.importPrometheusQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var selectorMatch, selector, labels, existingKeys, labelsToKeep, key, labelKeys, cleanSelector;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!query) {
                            return [2 /*return*/, ''];
                        }
                        selectorMatch = query.match(selectorRegexp);
                        if (!selectorMatch) {
                            return [2 /*return*/, ''];
                        }
                        selector = selectorMatch[0];
                        labels = {};
                        selector.replace(labelRegexp, function (_, key, operator, value) {
                            labels[key] = { value: value, operator: operator };
                            return '';
                        });
                        // Keep only labels that exist on origin and target datasource
                        return [4 /*yield*/, this.start()];
                    case 1:
                        // Keep only labels that exist on origin and target datasource
                        _a.sent(); // fetches all existing label keys
                        existingKeys = this.labelKeys;
                        labelsToKeep = {};
                        if (existingKeys && existingKeys.length) {
                            // Check for common labels
                            for (key in labels) {
                                if (existingKeys && existingKeys.includes(key)) {
                                    // Should we check for label value equality here?
                                    labelsToKeep[key] = labels[key];
                                }
                            }
                        }
                        else {
                            // Keep all labels by default
                            labelsToKeep = labels;
                        }
                        labelKeys = Object.keys(labelsToKeep).sort();
                        cleanSelector = labelKeys
                            .map(function (key) { return "" + key + labelsToKeep[key].operator + labelsToKeep[key].value; })
                            .join(',');
                        return [2 /*return*/, ['{', cleanSelector, '}'].join('')];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.getSeriesLabels = function (selector) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.lookupsDisabled) {
                            return [2 /*return*/, undefined];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.fetchSeriesLabels(selector)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_2 = _a.sent();
                        // TODO: better error handling
                        console.error(error_2);
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetches all label keys
     */
    LokiLanguageProvider.prototype.fetchLabels = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, timeRange, res, labels;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = '/loki/api/v1/label';
                        timeRange = this.datasource.getTimeRangeParams();
                        this.labelFetchTs = Date.now().valueOf();
                        return [4 /*yield*/, this.request(url, timeRange)];
                    case 1:
                        res = _a.sent();
                        if (Array.isArray(res)) {
                            labels = res
                                .slice()
                                .sort()
                                .filter(function (label) { return label !== '__name__'; });
                            this.labelKeys = labels;
                        }
                        return [2 /*return*/, []];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.refreshLogLabels = function (forceRefresh) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!((this.labelKeys && Date.now().valueOf() - this.labelFetchTs > LABEL_REFRESH_INTERVAL) || forceRefresh)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchLabels()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    // Cache key is a bit different here. We round up to a minute the intervals.
    // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
    // millisecond while still actually getting all the keys for the correct interval. This still can create problems
    // when user does not the newest values for a minute if already cached.
    LokiLanguageProvider.prototype.generateCacheKey = function (url, start, end, param) {
        return [url, this.roundTime(start), this.roundTime(end), param].join();
    };
    // Round nanos epoch to nearest 5 minute interval
    LokiLanguageProvider.prototype.roundTime = function (nanos) {
        return nanos ? Math.floor(nanos / NS_IN_MS / 1000 / 60 / 5) : 0;
    };
    LokiLanguageProvider.prototype.getLabelValues = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchLabelValues(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.fetchLabelValues = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var url, rangeParams, start, end, cacheKey, params, labelValues, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "/loki/api/v1/label/" + key + "/values";
                        rangeParams = this.datasource.getTimeRangeParams();
                        start = rangeParams.start, end = rangeParams.end;
                        cacheKey = this.generateCacheKey(url, start, end, key);
                        params = { start: start, end: end };
                        labelValues = this.labelsCache.get(cacheKey);
                        if (!!labelValues) return [3 /*break*/, 2];
                        // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
                        this.labelsCache.set(cacheKey, []);
                        return [4 /*yield*/, this.request(url, params)];
                    case 1:
                        res = _a.sent();
                        if (Array.isArray(res)) {
                            labelValues = res.slice().sort();
                            this.labelsCache.set(cacheKey, labelValues);
                        }
                        _a.label = 2;
                    case 2: return [2 /*return*/, labelValues !== null && labelValues !== void 0 ? labelValues : []];
                }
            });
        });
    };
    return LokiLanguageProvider;
}(LanguageProvider));
export default LokiLanguageProvider;
//# sourceMappingURL=language_provider.js.map