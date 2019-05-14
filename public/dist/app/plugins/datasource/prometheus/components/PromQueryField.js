import * as tslib_1 from "tslib";
import _ from 'lodash';
import React from 'react';
import Cascader from 'rc-cascader';
import PluginPrism from 'slate-prism';
import Prism from 'prismjs';
// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from 'app/features/explore/utils/dom';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';
import QueryField from 'app/features/explore/QueryField';
import { makePromiseCancelable } from 'app/core/utils/CancelablePromise';
var HISTOGRAM_GROUP = '__histograms__';
var METRIC_MARK = 'metric';
var PRISM_SYNTAX = 'promql';
export var RECORDING_RULES_GROUP = '__recording_rules__';
export function groupMetricsByPrefix(metrics, delimiter) {
    if (delimiter === void 0) { delimiter = '_'; }
    // Filter out recording rules and insert as first option
    var ruleRegex = /:\w+:/;
    var ruleNames = metrics.filter(function (metric) { return ruleRegex.test(metric); });
    var rulesOption = {
        label: 'Recording rules',
        value: RECORDING_RULES_GROUP,
        children: ruleNames
            .slice()
            .sort()
            .map(function (name) { return ({ label: name, value: name }); }),
    };
    var options = ruleNames.length > 0 ? [rulesOption] : [];
    var metricsOptions = _.chain(metrics)
        .filter(function (metric) { return !ruleRegex.test(metric); })
        .groupBy(function (metric) { return metric.split(delimiter)[0]; })
        .map(function (metricsForPrefix, prefix) {
        var prefixIsMetric = metricsForPrefix.length === 1 && metricsForPrefix[0] === prefix;
        var children = prefixIsMetric ? [] : metricsForPrefix.sort().map(function (m) { return ({ label: m, value: m }); });
        return {
            children: children,
            label: prefix,
            value: prefix,
        };
    })
        .sortBy('label')
        .value();
    return tslib_1.__spread(options, metricsOptions);
}
export function willApplySuggestion(suggestion, _a) {
    var typeaheadContext = _a.typeaheadContext, typeaheadText = _a.typeaheadText;
    // Modify suggestion based on context
    switch (typeaheadContext) {
        case 'context-labels': {
            var nextChar = getNextCharacter();
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
            if (getNextCharacter() !== '"') {
                suggestion = suggestion + "\"";
            }
            break;
        }
        default:
    }
    return suggestion;
}
var PromQueryField = /** @class */ (function (_super) {
    tslib_1.__extends(PromQueryField, _super);
    function PromQueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.onChangeMetrics = function (values, selectedOptions) {
            var query;
            if (selectedOptions.length === 1) {
                if (selectedOptions[0].children.length === 0) {
                    query = selectedOptions[0].value;
                }
                else {
                    // Ignore click on group
                    return;
                }
            }
            else {
                var prefix = selectedOptions[0].value;
                var metric = selectedOptions[1].value;
                if (prefix === HISTOGRAM_GROUP) {
                    query = "histogram_quantile(0.95, sum(rate(" + metric + "[5m])) by (le))";
                }
                else {
                    query = metric;
                }
            }
            _this.onChangeQuery(query, true);
        };
        _this.onChangeQuery = function (value, override) {
            // Send text change to parent
            var _a = _this.props, query = _a.query, onQueryChange = _a.onQueryChange, onExecuteQuery = _a.onExecuteQuery;
            if (onQueryChange) {
                var nextQuery = tslib_1.__assign({}, query, { expr: value });
                onQueryChange(nextQuery);
                if (override && onExecuteQuery) {
                    onExecuteQuery();
                }
            }
        };
        _this.onClickHintFix = function () {
            var _a = _this.props, hint = _a.hint, onExecuteHint = _a.onExecuteHint;
            if (onExecuteHint && hint && hint.fix) {
                onExecuteHint(hint.fix.action);
            }
        };
        _this.onUpdateLanguage = function () {
            var _a = _this.languageProvider, histogramMetrics = _a.histogramMetrics, metrics = _a.metrics;
            if (!metrics) {
                return;
            }
            Prism.languages[PRISM_SYNTAX] = _this.languageProvider.getSyntax();
            Prism.languages[PRISM_SYNTAX][METRIC_MARK] = {
                alias: 'variable',
                pattern: new RegExp("(?:^|\\s)(" + metrics.join('|') + ")(?:$|\\s)"),
            };
            // Build metrics tree
            var metricsByPrefix = groupMetricsByPrefix(metrics);
            var histogramOptions = histogramMetrics.map(function (hm) { return ({ label: hm, value: hm }); });
            var metricsOptions = histogramMetrics.length > 0
                ? tslib_1.__spread([
                    { label: 'Histograms', value: HISTOGRAM_GROUP, children: histogramOptions, isLeaf: false }
                ], metricsByPrefix) : metricsByPrefix;
            _this.setState({ metricsOptions: metricsOptions, syntaxLoaded: true });
        };
        _this.onTypeahead = function (typeahead) {
            if (!_this.languageProvider) {
                return { suggestions: [] };
            }
            var history = _this.props.history;
            var prefix = typeahead.prefix, text = typeahead.text, value = typeahead.value, wrapperNode = typeahead.wrapperNode;
            // Get DOM-dependent context
            var wrapperClasses = Array.from(wrapperNode.classList);
            var labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
            var labelKey = labelKeyNode && labelKeyNode.textContent;
            var nextChar = getNextCharacter();
            var result = _this.languageProvider.provideCompletionItems({ text: text, value: value, prefix: prefix, wrapperClasses: wrapperClasses, labelKey: labelKey }, { history: history });
            console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);
            return result;
        };
        if (props.datasource.languageProvider) {
            _this.languageProvider = props.datasource.languageProvider;
        }
        _this.plugins = [
            BracesPlugin(),
            RunnerPlugin({ handler: props.onExecuteQuery }),
            PluginPrism({
                onlyIn: function (node) { return node.type === 'code_block'; },
                getSyntax: function (node) { return 'promql'; },
            }),
        ];
        _this.state = {
            metricsOptions: [],
            syntaxLoaded: false,
        };
        return _this;
    }
    PromQueryField.prototype.componentDidMount = function () {
        var _this = this;
        if (this.languageProvider) {
            this.languageProviderInitializationPromise = makePromiseCancelable(this.languageProvider.start());
            this.languageProviderInitializationPromise.promise
                .then(function (remaining) {
                remaining.map(function (task) { return task.then(_this.onUpdateLanguage).catch(function () { }); });
            })
                .then(function () { return _this.onUpdateLanguage(); })
                .catch(function (_a) {
                var isCanceled = _a.isCanceled;
                if (isCanceled) {
                    console.warn('PromQueryField has unmounted, language provider intialization was canceled');
                }
            });
        }
    };
    PromQueryField.prototype.componentWillUnmount = function () {
        if (this.languageProviderInitializationPromise) {
            this.languageProviderInitializationPromise.cancel();
        }
    };
    PromQueryField.prototype.render = function () {
        var _a = this.props, error = _a.error, hint = _a.hint, query = _a.query;
        var _b = this.state, metricsOptions = _b.metricsOptions, syntaxLoaded = _b.syntaxLoaded;
        var cleanText = this.languageProvider ? this.languageProvider.cleanText : undefined;
        var chooserText = syntaxLoaded ? 'Metrics' : 'Loading metrics...';
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline gf-form-inline--nowrap" },
                React.createElement("div", { className: "gf-form flex-shrink-0" },
                    React.createElement(Cascader, { options: metricsOptions, onChange: this.onChangeMetrics },
                        React.createElement("button", { className: "gf-form-label gf-form-label--btn", disabled: !syntaxLoaded },
                            chooserText,
                            " ",
                            React.createElement("i", { className: "fa fa-caret-down" })))),
                React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1" },
                    React.createElement(QueryField, { additionalPlugins: this.plugins, cleanText: cleanText, initialQuery: query.expr, onTypeahead: this.onTypeahead, onWillApplySuggestion: willApplySuggestion, onQueryChange: this.onChangeQuery, onExecuteQuery: this.props.onExecuteQuery, placeholder: "Enter a PromQL query", portalOrigin: "prometheus", syntaxLoaded: syntaxLoaded }))),
            error ? React.createElement("div", { className: "prom-query-field-info text-error" }, error) : null,
            hint ? (React.createElement("div", { className: "prom-query-field-info text-warning" },
                hint.label,
                ' ',
                hint.fix ? (React.createElement("a", { className: "text-link muted", onClick: this.onClickHintFix }, hint.fix.label)) : null)) : null));
    };
    return PromQueryField;
}(React.PureComponent));
export default PromQueryField;
//# sourceMappingURL=PromQueryField.js.map