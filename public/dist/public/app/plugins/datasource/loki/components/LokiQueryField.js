import { __assign, __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { SlatePrism, QueryField, BracesPlugin, DOMUtil, Icon, } from '@grafana/ui';
import { LokiLabelBrowser } from './LokiLabelBrowser';
import { languages as prismLanguages } from 'prismjs';
import { shouldRefreshLabels } from '../language_utils';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
var LAST_USED_LABELS_KEY = 'grafana.datasources.loki.browser.labels';
function getChooserText(hasSyntax, hasLogLabels) {
    if (!hasSyntax) {
        return 'Loading labels...';
    }
    if (!hasLogLabels) {
        return '(No logs found)';
    }
    return 'Log browser';
}
function willApplySuggestion(suggestion, _a) {
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
var LokiQueryField = /** @class */ (function (_super) {
    __extends(LokiQueryField, _super);
    function LokiQueryField(props) {
        var _this = _super.call(this, props) || this;
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
        _this.onTypeahead = function (typeahead) { return __awaiter(_this, void 0, void 0, function () {
            var datasource, lokiLanguageProvider, history, prefix, text, value, wrapperClasses, labelKey, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = this.props.datasource;
                        if (!datasource.languageProvider) {
                            return [2 /*return*/, { suggestions: [] }];
                        }
                        lokiLanguageProvider = datasource.languageProvider;
                        history = this.props.history;
                        prefix = typeahead.prefix, text = typeahead.text, value = typeahead.value, wrapperClasses = typeahead.wrapperClasses, labelKey = typeahead.labelKey;
                        return [4 /*yield*/, lokiLanguageProvider.provideCompletionItems({ text: text, value: value, prefix: prefix, wrapperClasses: wrapperClasses, labelKey: labelKey }, { history: history })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        }); };
        _this.state = { labelsLoaded: false, labelBrowserVisible: false };
        _this.plugins = [
            BracesPlugin(),
            SlatePrism({
                onlyIn: function (node) { return node.object === 'block' && node.type === 'code_block'; },
                getSyntax: function (node) { return 'logql'; },
            }, __assign(__assign({}, prismLanguages), { logql: _this.props.datasource.languageProvider.getSyntax() })),
        ];
        return _this;
    }
    LokiQueryField.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.datasource.languageProvider.start()];
                    case 1:
                        _a.sent();
                        this.setState({ labelsLoaded: true });
                        return [2 /*return*/];
                }
            });
        });
    };
    LokiQueryField.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, range = _a.range, languageProvider = _a.datasource.languageProvider;
        var refreshLabels = shouldRefreshLabels(range, prevProps.range);
        // We want to refresh labels when range changes (we round up intervals to a minute)
        if (refreshLabels) {
            languageProvider.fetchLabels();
        }
    };
    LokiQueryField.prototype.render = function () {
        var _this = this;
        var _a = this.props, ExtraFieldElement = _a.ExtraFieldElement, query = _a.query, datasource = _a.datasource, _b = _a.placeholder, placeholder = _b === void 0 ? 'Enter a Loki query (run with Shift+Enter)' : _b;
        var _c = this.state, labelsLoaded = _c.labelsLoaded, labelBrowserVisible = _c.labelBrowserVisible;
        var lokiLanguageProvider = datasource.languageProvider;
        var cleanText = datasource.languageProvider ? lokiLanguageProvider.cleanText : undefined;
        var hasLogLabels = lokiLanguageProvider.getLabelKeys().length > 0;
        var chooserText = getChooserText(labelsLoaded, hasLogLabels);
        var buttonDisabled = !(labelsLoaded && hasLogLabels);
        return (React.createElement(LocalStorageValueProvider, { storageKey: LAST_USED_LABELS_KEY, defaultValue: [] }, function (lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) {
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1", "data-testid": _this.props['data-testid'] },
                    React.createElement("button", { className: "gf-form-label query-keyword pointer", onClick: _this.onClickChooserButton, disabled: buttonDisabled },
                        chooserText,
                        React.createElement(Icon, { name: labelBrowserVisible ? 'angle-down' : 'angle-right' })),
                    React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1 min-width-15" },
                        React.createElement(QueryField, { additionalPlugins: _this.plugins, cleanText: cleanText, query: query.expr, onTypeahead: _this.onTypeahead, onWillApplySuggestion: willApplySuggestion, onChange: _this.onChangeQuery, onBlur: _this.props.onBlur, onRunQuery: _this.props.onRunQuery, placeholder: placeholder, portalOrigin: "loki" }))),
                labelBrowserVisible && (React.createElement("div", { className: "gf-form" },
                    React.createElement(LokiLabelBrowser, { languageProvider: lokiLanguageProvider, onChange: _this.onChangeLabelBrowser, lastUsedLabels: lastUsedLabels || [], storeLastUsedLabels: onLastUsedLabelsSave, deleteLastUsedLabels: onLastUsedLabelsDelete }))),
                ExtraFieldElement));
        }));
    };
    return LokiQueryField;
}(React.PureComponent));
export { LokiQueryField };
//# sourceMappingURL=LokiQueryField.js.map