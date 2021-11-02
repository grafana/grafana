import { __assign, __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { config } from '@grafana/runtime';
import { SlatePrism, QueryField, BracesPlugin, DOMUtil, Icon, } from '@grafana/ui';
import { languages as prismLanguages } from 'prismjs';
import { roundMsToMin } from '../language_utils';
import { makePromiseCancelable } from 'app/core/utils/CancelablePromise';
import { isDataFrame, toLegacyResponseData, CoreApp } from '@grafana/data';
import { PrometheusMetricsBrowser } from './PrometheusMetricsBrowser';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
export var RECORDING_RULES_GROUP = '__recording_rules__';
var LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';
function getChooserText(metricsLookupDisabled, hasSyntax, hasMetrics) {
    if (metricsLookupDisabled) {
        return '(Disabled)';
    }
    if (!hasSyntax) {
        return 'Loading metrics...';
    }
    if (!hasMetrics) {
        return '(No metrics found)';
    }
    return 'Metrics browser';
}
export function willApplySuggestion(suggestion, _a) {
    var typeaheadContext = _a.typeaheadContext, typeaheadText = _a.typeaheadText;
    // Modify suggestion based on context
    switch (typeaheadContext) {
        case 'context-labels': {
            var nextChar = DOMUtil.getNextCharacter();
            if (!nextChar || nextChar === '}' || nextChar === ',') {
                suggestion += '=';
            }
            break;
        }
        case 'context-label-values': {
            // Always add quotes and remove existing ones instead
            if (!typeaheadText.match(/^(!?=~?"|")/)) {
                suggestion = "\"" + suggestion;
            }
            if (DOMUtil.getNextCharacter() !== '"') {
                suggestion = suggestion + "\"";
            }
            break;
        }
        default:
    }
    return suggestion;
}
var PromQueryField = /** @class */ (function (_super) {
    __extends(PromQueryField, _super);
    function PromQueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.refreshHint = function () {
            var _a = _this.props, datasource = _a.datasource, query = _a.query, data = _a.data;
            var initHints = datasource.getInitHints();
            var initHint = initHints.length > 0 ? initHints[0] : null;
            if (!data || data.series.length === 0) {
                _this.setState({
                    hint: initHint,
                });
                return;
            }
            var result = isDataFrame(data.series[0]) ? data.series.map(toLegacyResponseData) : data.series;
            var queryHints = datasource.getQueryHints(query, result);
            var queryHint = queryHints.length > 0 ? queryHints[0] : null;
            _this.setState({ hint: queryHint !== null && queryHint !== void 0 ? queryHint : initHint });
        };
        _this.refreshMetrics = function () { return __awaiter(_this, void 0, void 0, function () {
            var languageProvider, remainingTasks, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        languageProvider = this.props.datasource.languageProvider;
                        this.languageProviderInitializationPromise = makePromiseCancelable(languageProvider.start());
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.languageProviderInitializationPromise.promise];
                    case 2:
                        remainingTasks = _a.sent();
                        return [4 /*yield*/, Promise.all(remainingTasks)];
                    case 3:
                        _a.sent();
                        this.onUpdateLanguage();
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        if (!err_1.isCanceled) {
                            throw err_1;
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        /**
         * TODO #33976: Remove this, add histogram group (query = `histogram_quantile(0.95, sum(rate(${metric}[5m])) by (le))`;)
         */
        _this.onChangeLabelBrowser = function (selector) {
            _this.onChangeQuery(selector, true);
            _this.setState({ labelBrowserVisible: false });
        };
        _this.onChangeQuery = function (value, override) {
            // Send text change to parent
            var _a = _this.props, query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
            if (onChange) {
                var nextQuery = __assign(__assign({}, query), { expr: value });
                onChange(nextQuery);
                if (override && onRunQuery) {
                    onRunQuery();
                }
            }
        };
        _this.onClickChooserButton = function () {
            _this.setState(function (state) { return ({ labelBrowserVisible: !state.labelBrowserVisible }); });
        };
        _this.onClickHintFix = function () {
            var _a = _this.props, datasource = _a.datasource, query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
            var hint = _this.state.hint;
            onChange(datasource.modifyQuery(query, hint.fix.action));
            onRunQuery();
        };
        _this.onUpdateLanguage = function () {
            var languageProvider = _this.props.datasource.languageProvider;
            var metrics = languageProvider.metrics;
            if (!metrics) {
                return;
            }
            _this.setState({ syntaxLoaded: true });
        };
        _this.onTypeahead = function (typeahead) { return __awaiter(_this, void 0, void 0, function () {
            var languageProvider, history, prefix, text, value, wrapperClasses, labelKey, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        languageProvider = this.props.datasource.languageProvider;
                        if (!languageProvider) {
                            return [2 /*return*/, { suggestions: [] }];
                        }
                        history = this.props.history;
                        prefix = typeahead.prefix, text = typeahead.text, value = typeahead.value, wrapperClasses = typeahead.wrapperClasses, labelKey = typeahead.labelKey;
                        return [4 /*yield*/, languageProvider.provideCompletionItems({ text: text, value: value, prefix: prefix, wrapperClasses: wrapperClasses, labelKey: labelKey }, { history: history })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        }); };
        _this.plugins = [
            BracesPlugin(),
            SlatePrism({
                onlyIn: function (node) { return node.type === 'code_block'; },
                getSyntax: function (node) { return 'promql'; },
            }, __assign(__assign({}, prismLanguages), { promql: _this.props.datasource.languageProvider.syntax })),
        ];
        _this.state = {
            labelBrowserVisible: false,
            syntaxLoaded: false,
            hint: null,
        };
        return _this;
    }
    PromQueryField.prototype.componentDidMount = function () {
        if (this.props.datasource.languageProvider) {
            this.refreshMetrics();
        }
        this.refreshHint();
    };
    PromQueryField.prototype.componentWillUnmount = function () {
        if (this.languageProviderInitializationPromise) {
            this.languageProviderInitializationPromise.cancel();
        }
    };
    PromQueryField.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, data = _a.data, languageProvider = _a.datasource.languageProvider, range = _a.range;
        if (languageProvider !== prevProps.datasource.languageProvider) {
            // We reset this only on DS change so we do not flesh loading state on every rangeChange which happens on every
            // query run if using relative range.
            this.setState({
                syntaxLoaded: false,
            });
        }
        var changedRangeToRefresh = this.rangeChangedToRefresh(range, prevProps.range);
        // We want to refresh metrics when language provider changes and/or when range changes (we round up intervals to a minute)
        if (languageProvider !== prevProps.datasource.languageProvider || changedRangeToRefresh) {
            this.refreshMetrics();
        }
        if (data && prevProps.data && prevProps.data.series !== data.series) {
            this.refreshHint();
        }
    };
    PromQueryField.prototype.rangeChangedToRefresh = function (range, prevRange) {
        if (range && prevRange) {
            var sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
            var sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
            // If both are same, don't need to refresh.
            return !(sameMinuteFrom && sameMinuteTo);
        }
        return false;
    };
    PromQueryField.prototype.render = function () {
        var _this = this;
        var _a = this.props, datasource = _a.datasource, languageProvider = _a.datasource.languageProvider, query = _a.query, ExtraFieldElement = _a.ExtraFieldElement, _b = _a.placeholder, placeholder = _b === void 0 ? 'Enter a PromQL query (run with Shift+Enter)' : _b, _c = _a.history, history = _c === void 0 ? [] : _c;
        var _d = this.state, labelBrowserVisible = _d.labelBrowserVisible, syntaxLoaded = _d.syntaxLoaded, hint = _d.hint;
        var cleanText = languageProvider ? languageProvider.cleanText : undefined;
        var hasMetrics = languageProvider.metrics.length > 0;
        var chooserText = getChooserText(datasource.lookupsDisabled, syntaxLoaded, hasMetrics);
        var buttonDisabled = !(syntaxLoaded && hasMetrics);
        var isMonacoEditorEnabled = config.featureToggles.prometheusMonaco;
        return (React.createElement(LocalStorageValueProvider, { storageKey: LAST_USED_LABELS_KEY, defaultValue: [] }, function (lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) {
            var _a;
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1", "data-testid": _this.props['data-testid'] },
                    React.createElement("button", { className: "gf-form-label query-keyword pointer", onClick: _this.onClickChooserButton, disabled: buttonDisabled },
                        chooserText,
                        React.createElement(Icon, { name: labelBrowserVisible ? 'angle-down' : 'angle-right' })),
                    React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1 min-width-15" }, isMonacoEditorEnabled ? (React.createElement(MonacoQueryFieldWrapper, { runQueryOnBlur: _this.props.app !== CoreApp.Explore, languageProvider: languageProvider, history: history, onChange: _this.onChangeQuery, onRunQuery: _this.props.onRunQuery, initialValue: (_a = query.expr) !== null && _a !== void 0 ? _a : '' })) : (React.createElement(QueryField, { additionalPlugins: _this.plugins, cleanText: cleanText, query: query.expr, onTypeahead: _this.onTypeahead, onWillApplySuggestion: willApplySuggestion, onBlur: _this.props.onBlur, onChange: _this.onChangeQuery, onRunQuery: _this.props.onRunQuery, placeholder: placeholder, portalOrigin: "prometheus", syntaxLoaded: syntaxLoaded })))),
                labelBrowserVisible && (React.createElement("div", { className: "gf-form" },
                    React.createElement(PrometheusMetricsBrowser, { languageProvider: languageProvider, onChange: _this.onChangeLabelBrowser, lastUsedLabels: lastUsedLabels || [], storeLastUsedLabels: onLastUsedLabelsSave, deleteLastUsedLabels: onLastUsedLabelsDelete }))),
                ExtraFieldElement,
                hint ? (React.createElement("div", { className: "query-row-break" },
                    React.createElement("div", { className: "prom-query-field-info text-warning" },
                        hint.label,
                        ' ',
                        hint.fix ? (React.createElement("a", { className: "text-link muted", onClick: _this.onClickHintFix }, hint.fix.label)) : null))) : null));
        }));
    };
    return PromQueryField;
}(React.PureComponent));
export default PromQueryField;
//# sourceMappingURL=PromQueryField.js.map