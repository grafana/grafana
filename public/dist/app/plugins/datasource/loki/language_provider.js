import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
import moment from 'moment';
// Services & Utils
import { parseSelector, labelRegexp, selectorRegexp } from 'app/plugins/datasource/prometheus/language_utils';
import syntax from './syntax';
// Types
import { LanguageProvider, } from 'app/types/explore';
var DEFAULT_KEYS = ['job', 'namespace'];
var EMPTY_SELECTOR = '{}';
var HISTORY_ITEM_COUNT = 10;
var HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
var wrapLabel = function (label) { return ({ label: label }); };
export function addHistoryMetadata(item, history) {
    var cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
    var historyForItem = history.filter(function (h) { return h.ts > cutoffTs && h.query.expr === item.label; });
    var count = historyForItem.length;
    var recent = historyForItem[0];
    var hint = "Queried " + count + " times in the last 24h.";
    if (recent) {
        var lastQueried = moment(recent.ts).fromNow();
        hint = hint + " Last queried " + lastQueried + ".";
    }
    return tslib_1.__assign({}, item, { documentation: hint });
}
var LokiLanguageProvider = /** @class */ (function (_super) {
    tslib_1.__extends(LokiLanguageProvider, _super);
    function LokiLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        // Strip syntax chars
        _this.cleanText = function (s) { return s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim(); };
        _this.request = function (url) {
            return _this.datasource.metadataRequest(url);
        };
        _this.start = function () {
            if (!_this.startTask) {
                _this.startTask = _this.fetchLogLabels();
            }
            return _this.startTask;
        };
        _this.datasource = datasource;
        _this.labelKeys = {};
        _this.labelValues = {};
        Object.assign(_this, initialValues);
        return _this;
    }
    LokiLanguageProvider.prototype.getSyntax = function () {
        return syntax;
    };
    // Keep this DOM-free for testing
    LokiLanguageProvider.prototype.provideCompletionItems = function (_a, context) {
        var prefix = _a.prefix, wrapperClasses = _a.wrapperClasses, text = _a.text, value = _a.value;
        // Local text properties
        var empty = value.document.text.length === 0;
        // Determine candidates by CSS context
        if (_.includes(wrapperClasses, 'context-labels')) {
            // Suggestions for {|} and {foo=|}
            return this.getLabelCompletionItems.apply(this, arguments);
        }
        else if (empty) {
            return this.getEmptyCompletionItems(context || {});
        }
        return {
            suggestions: [],
        };
    };
    LokiLanguageProvider.prototype.getEmptyCompletionItems = function (context) {
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
        return { suggestions: suggestions };
    };
    LokiLanguageProvider.prototype.getLabelCompletionItems = function (_a) {
        var text = _a.text, wrapperClasses = _a.wrapperClasses, labelKey = _a.labelKey, value = _a.value;
        var context;
        var refresher = null;
        var suggestions = [];
        var line = value.anchorBlock.getText();
        var cursorOffset = value.anchorOffset;
        // Use EMPTY_SELECTOR until series API is implemented for facetting
        var selector = EMPTY_SELECTOR;
        var parsedSelector;
        try {
            parsedSelector = parseSelector(line, cursorOffset);
        }
        catch (_b) { }
        var existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
        if ((text && text.match(/^!?=~?/)) || _.includes(wrapperClasses, 'attr-value')) {
            // Label values
            if (labelKey && this.labelValues[selector]) {
                var labelValues = this.labelValues[selector][labelKey];
                if (labelValues) {
                    context = 'context-label-values';
                    suggestions.push({
                        label: "Label values for \"" + labelKey + "\"",
                        items: labelValues.map(wrapLabel),
                    });
                }
                else {
                    refresher = this.fetchLabelValues(labelKey);
                }
            }
        }
        else {
            // Label keys
            var labelKeys = this.labelKeys[selector] || DEFAULT_KEYS;
            if (labelKeys) {
                var possibleKeys = _.difference(labelKeys, existingKeys);
                if (possibleKeys.length > 0) {
                    context = 'context-labels';
                    suggestions.push({ label: "Labels", items: possibleKeys.map(wrapLabel) });
                }
            }
        }
        return { context: context, refresher: refresher, suggestions: suggestions };
    };
    LokiLanguageProvider.prototype.importQueries = function (queries, datasourceType) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                if (datasourceType === 'prometheus') {
                    return [2 /*return*/, Promise.all(queries.map(function (query) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var expr;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.importPrometheusQuery(query.expr)];
                                    case 1:
                                        expr = _a.sent();
                                        return [2 /*return*/, tslib_1.__assign({}, query, { expr: expr })];
                                }
                            });
                        }); }))];
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
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var selectorMatch, selector, labels_1, existingKeys, labelsToKeep_1, key, labelKeys, cleanSelector;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!query) {
                            return [2 /*return*/, ''];
                        }
                        selectorMatch = query.match(selectorRegexp);
                        if (!selectorMatch) return [3 /*break*/, 2];
                        selector = selectorMatch[0];
                        labels_1 = {};
                        selector.replace(labelRegexp, function (_, key, operator, value) {
                            labels_1[key] = { value: value, operator: operator };
                            return '';
                        });
                        // Keep only labels that exist on origin and target datasource
                        return [4 /*yield*/, this.start()];
                    case 1:
                        // Keep only labels that exist on origin and target datasource
                        _a.sent(); // fetches all existing label keys
                        existingKeys = this.labelKeys[EMPTY_SELECTOR];
                        labelsToKeep_1 = {};
                        if (existingKeys && existingKeys.length > 0) {
                            // Check for common labels
                            for (key in labels_1) {
                                if (existingKeys && existingKeys.indexOf(key) > -1) {
                                    // Should we check for label value equality here?
                                    labelsToKeep_1[key] = labels_1[key];
                                }
                            }
                        }
                        else {
                            // Keep all labels by default
                            labelsToKeep_1 = labels_1;
                        }
                        labelKeys = Object.keys(labelsToKeep_1).sort();
                        cleanSelector = labelKeys
                            .map(function (key) { return "" + key + labelsToKeep_1[key].operator + labelsToKeep_1[key].value; })
                            .join(',');
                        return [2 /*return*/, ['{', cleanSelector, '}'].join('')];
                    case 2: return [2 /*return*/, ''];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.fetchLogLabels = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, url, res, body, labelKeys, e_1;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = '/api/prom/label';
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.request(url)];
                    case 2:
                        res = _b.sent();
                        return [4 /*yield*/, (res.data || res.json())];
                    case 3:
                        body = _b.sent();
                        labelKeys = body.data.slice().sort();
                        this.labelKeys = tslib_1.__assign({}, this.labelKeys, (_a = {}, _a[EMPTY_SELECTOR] = labelKeys, _a));
                        this.logLabelOptions = labelKeys.map(function (key) { return ({ label: key, value: key, isLeaf: false }); });
                        // Pre-load values for default labels
                        return [2 /*return*/, labelKeys.filter(function (key) { return DEFAULT_KEYS.indexOf(key) > -1; }).map(function (key) { return _this.fetchLabelValues(key); })];
                    case 4:
                        e_1 = _b.sent();
                        console.error(e_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, []];
                }
            });
        });
    };
    LokiLanguageProvider.prototype.fetchLabelValues = function (key) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, _b, url, res, body, values_1, exisingValues, nextValues, e_2;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        url = "/api/prom/label/" + key + "/values";
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.request(url)];
                    case 2:
                        res = _c.sent();
                        return [4 /*yield*/, (res.data || res.json())];
                    case 3:
                        body = _c.sent();
                        values_1 = body.data.slice().sort();
                        // Add to label options
                        this.logLabelOptions = this.logLabelOptions.map(function (keyOption) {
                            if (keyOption.value === key) {
                                return tslib_1.__assign({}, keyOption, { children: values_1.map(function (value) { return ({ label: value, value: value }); }) });
                            }
                            return keyOption;
                        });
                        exisingValues = this.labelValues[EMPTY_SELECTOR];
                        nextValues = tslib_1.__assign({}, exisingValues, (_a = {}, _a[key] = values_1, _a));
                        this.labelValues = tslib_1.__assign({}, this.labelValues, (_b = {}, _b[EMPTY_SELECTOR] = nextValues, _b));
                        return [3 /*break*/, 5];
                    case 4:
                        e_2 = _c.sent();
                        console.error(e_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return LokiLanguageProvider;
}(LanguageProvider));
export default LokiLanguageProvider;
//# sourceMappingURL=language_provider.js.map