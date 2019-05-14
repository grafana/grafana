import * as tslib_1 from "tslib";
// Libraries
import React from 'react';
import Cascader from 'rc-cascader';
import PluginPrism from 'slate-prism';
import Prism from 'prismjs';
// Components
import QueryField from 'app/features/explore/QueryField';
// Utils & Services
// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from 'app/features/explore/utils/dom';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';
import { makePromiseCancelable } from 'app/core/utils/CancelablePromise';
var PRISM_SYNTAX = 'promql';
function getChooserText(hasSytax, hasLogLabels) {
    if (!hasSytax) {
        return 'Loading labels...';
    }
    if (!hasLogLabels) {
        return '(No labels found)';
    }
    return 'Log labels';
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
var LokiQueryField = /** @class */ (function (_super) {
    tslib_1.__extends(LokiQueryField, _super);
    function LokiQueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.loadOptions = function (selectedOptions) {
            var targetOption = selectedOptions[selectedOptions.length - 1];
            _this.setState(function (state) {
                var nextOptions = state.logLabelOptions.map(function (option) {
                    if (option.value === targetOption.value) {
                        return tslib_1.__assign({}, option, { loading: true });
                    }
                    return option;
                });
                return { logLabelOptions: nextOptions };
            });
            _this.languageProvider
                .fetchLabelValues(targetOption.value)
                .then(_this.onUpdateLanguage)
                .catch(function () { });
        };
        _this.onChangeLogLabels = function (values, selectedOptions) {
            if (selectedOptions.length === 2) {
                var key = selectedOptions[0].value;
                var value = selectedOptions[1].value;
                var query = "{" + key + "=\"" + value + "\"}";
                _this.onChangeQuery(query, true);
            }
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
            Prism.languages[PRISM_SYNTAX] = _this.languageProvider.getSyntax();
            var logLabelOptions = _this.languageProvider.logLabelOptions;
            _this.setState({
                logLabelOptions: logLabelOptions,
                syntaxLoaded: true,
            });
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
        _this.pluginsSearch = [RunnerPlugin({ handler: props.onExecuteQuery })];
        _this.state = {
            logLabelOptions: [],
            syntaxLoaded: false,
        };
        return _this;
    }
    LokiQueryField.prototype.componentDidMount = function () {
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
                    console.warn('LokiQueryField has unmounted, language provider intialization was canceled');
                }
            });
        }
    };
    LokiQueryField.prototype.componentWillUnmount = function () {
        if (this.languageProviderInitializationPromise) {
            this.languageProviderInitializationPromise.cancel();
        }
    };
    LokiQueryField.prototype.render = function () {
        var _a = this.props, error = _a.error, hint = _a.hint, query = _a.query;
        var _b = this.state, logLabelOptions = _b.logLabelOptions, syntaxLoaded = _b.syntaxLoaded;
        var cleanText = this.languageProvider ? this.languageProvider.cleanText : undefined;
        var hasLogLabels = logLabelOptions && logLabelOptions.length > 0;
        var chooserText = getChooserText(syntaxLoaded, hasLogLabels);
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(Cascader, { options: logLabelOptions, onChange: this.onChangeLogLabels, loadData: this.loadOptions },
                        React.createElement("button", { className: "gf-form-label gf-form-label--btn", disabled: !syntaxLoaded },
                            chooserText,
                            " ",
                            React.createElement("i", { className: "fa fa-caret-down" })))),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(QueryField, { additionalPlugins: this.plugins, cleanText: cleanText, initialQuery: query.expr, onTypeahead: this.onTypeahead, onWillApplySuggestion: willApplySuggestion, onQueryChange: this.onChangeQuery, onExecuteQuery: this.props.onExecuteQuery, placeholder: "Enter a Loki query", portalOrigin: "loki", syntaxLoaded: syntaxLoaded }))),
            React.createElement("div", null,
                error ? React.createElement("div", { className: "prom-query-field-info text-error" }, error) : null,
                hint ? (React.createElement("div", { className: "prom-query-field-info text-warning" },
                    hint.label,
                    ' ',
                    hint.fix ? (React.createElement("a", { className: "text-link muted", onClick: this.onClickHintFix }, hint.fix.label)) : null)) : null)));
    };
    return LokiQueryField;
}(React.PureComponent));
export { LokiQueryField };
export default LokiQueryField;
//# sourceMappingURL=LokiQueryField.js.map