import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import { languages as prismLanguages } from 'prismjs';
import React from 'react';
import { isDataFrame, toLegacyResponseData } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import { BracesPlugin, DOMUtil, Icon, SlatePrism, withTheme2, clearButtonStyles, } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { isCancelablePromiseRejection, makePromiseCancelable, } from 'app/core/utils/CancelablePromise';
import { roundMsToMin } from '../language_utils';
import { PrometheusMetricsBrowser } from './PrometheusMetricsBrowser';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';
export const RECORDING_RULES_GROUP = '__recording_rules__';
const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';
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
export function willApplySuggestion(suggestion, { typeaheadContext, typeaheadText }) {
    // Modify suggestion based on context
    switch (typeaheadContext) {
        case 'context-labels': {
            const nextChar = DOMUtil.getNextCharacter();
            if (!nextChar || nextChar === '}' || nextChar === ',') {
                suggestion += '=';
            }
            break;
        }
        case 'context-label-values': {
            // Always add quotes and remove existing ones instead
            if (!typeaheadText.match(/^(!?=~?"|")/)) {
                suggestion = `"${suggestion}`;
            }
            if (DOMUtil.getNextCharacter() !== '"') {
                suggestion = `${suggestion}"`;
            }
            break;
        }
        default:
    }
    return suggestion;
}
class PromQueryField extends React.PureComponent {
    constructor(props, context) {
        super(props, context);
        this.refreshHint = () => {
            const { datasource, query, data } = this.props;
            const initHints = datasource.getInitHints();
            const initHint = initHints.length > 0 ? initHints[0] : null;
            if (!data || data.series.length === 0) {
                this.setState({
                    hint: initHint,
                });
                return;
            }
            const result = isDataFrame(data.series[0]) ? data.series.map(toLegacyResponseData) : data.series;
            const queryHints = datasource.getQueryHints(query, result);
            let queryHint = queryHints.length > 0 ? queryHints[0] : null;
            this.setState({ hint: queryHint !== null && queryHint !== void 0 ? queryHint : initHint });
        };
        this.refreshMetrics = () => __awaiter(this, void 0, void 0, function* () {
            const { datasource: { languageProvider }, } = this.props;
            this.languageProviderInitializationPromise = makePromiseCancelable(languageProvider.start());
            try {
                const remainingTasks = yield this.languageProviderInitializationPromise.promise;
                yield Promise.all(remainingTasks);
                this.onUpdateLanguage();
            }
            catch (err) {
                if (isCancelablePromiseRejection(err) && err.isCanceled) {
                    // do nothing, promise was canceled
                }
                else {
                    throw err;
                }
            }
        });
        /**
         * TODO #33976: Remove this, add histogram group (query = `histogram_quantile(0.95, sum(rate(${metric}[5m])) by (le))`;)
         */
        this.onChangeLabelBrowser = (selector) => {
            this.onChangeQuery(selector, true);
            this.setState({ labelBrowserVisible: false });
        };
        this.onChangeQuery = (value, override) => {
            // Send text change to parent
            const { query, onChange, onRunQuery } = this.props;
            if (onChange) {
                const nextQuery = Object.assign(Object.assign({}, query), { expr: value });
                onChange(nextQuery);
                if (override && onRunQuery) {
                    onRunQuery();
                }
            }
        };
        this.onClickChooserButton = () => {
            var _a, _b;
            this.setState((state) => ({ labelBrowserVisible: !state.labelBrowserVisible }));
            reportInteraction('user_grafana_prometheus_metrics_browser_clicked', {
                editorMode: this.state.labelBrowserVisible ? 'metricViewClosed' : 'metricViewOpen',
                app: (_b = (_a = this.props) === null || _a === void 0 ? void 0 : _a.app) !== null && _b !== void 0 ? _b : '',
            });
        };
        this.onClickHintFix = () => {
            var _a;
            const { datasource, query, onChange, onRunQuery } = this.props;
            const { hint } = this.state;
            if ((_a = hint === null || hint === void 0 ? void 0 : hint.fix) === null || _a === void 0 ? void 0 : _a.action) {
                onChange(datasource.modifyQuery(query, hint.fix.action));
            }
            onRunQuery();
        };
        this.onUpdateLanguage = () => {
            const { datasource: { languageProvider }, } = this.props;
            const { metrics } = languageProvider;
            if (!metrics) {
                return;
            }
            this.setState({ syntaxLoaded: true });
        };
        this.onTypeahead = (typeahead) => __awaiter(this, void 0, void 0, function* () {
            const { datasource: { languageProvider }, } = this.props;
            if (!languageProvider) {
                return { suggestions: [] };
            }
            const { history } = this.props;
            const { prefix, text, value, wrapperClasses, labelKey } = typeahead;
            const result = yield languageProvider.provideCompletionItems({ text, value, prefix, wrapperClasses, labelKey }, { history });
            return result;
        });
        this.plugins = [
            BracesPlugin(),
            SlatePrism({
                onlyIn: (node) => 'type' in node && node.type === 'code_block',
                getSyntax: (node) => 'promql',
            }, Object.assign(Object.assign({}, prismLanguages), { promql: this.props.datasource.languageProvider.syntax })),
        ];
        this.state = {
            labelBrowserVisible: false,
            syntaxLoaded: false,
            hint: null,
        };
    }
    componentDidMount() {
        if (this.props.datasource.languageProvider) {
            this.refreshMetrics();
        }
        this.refreshHint();
    }
    componentWillUnmount() {
        if (this.languageProviderInitializationPromise) {
            this.languageProviderInitializationPromise.cancel();
        }
    }
    componentDidUpdate(prevProps) {
        const { data, datasource: { languageProvider }, range, } = this.props;
        if (languageProvider !== prevProps.datasource.languageProvider) {
            // We reset this only on DS change so we do not flesh loading state on every rangeChange which happens on every
            // query run if using relative range.
            this.setState({
                syntaxLoaded: false,
            });
        }
        const changedRangeToRefresh = this.rangeChangedToRefresh(range, prevProps.range);
        // We want to refresh metrics when language provider changes and/or when range changes (we round up intervals to a minute)
        if (languageProvider !== prevProps.datasource.languageProvider || changedRangeToRefresh) {
            this.refreshMetrics();
        }
        if (data && prevProps.data && prevProps.data.series !== data.series) {
            this.refreshHint();
        }
    }
    rangeChangedToRefresh(range, prevRange) {
        if (range && prevRange) {
            const sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
            const sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
            // If both are same, don't need to refresh.
            return !(sameMinuteFrom && sameMinuteTo);
        }
        return false;
    }
    render() {
        const { datasource, datasource: { languageProvider }, query, ExtraFieldElement, history = [], theme, } = this.props;
        const { labelBrowserVisible, syntaxLoaded, hint } = this.state;
        const hasMetrics = languageProvider.metrics.length > 0;
        const chooserText = getChooserText(datasource.lookupsDisabled, syntaxLoaded, hasMetrics);
        const buttonDisabled = !(syntaxLoaded && hasMetrics);
        return (React.createElement(LocalStorageValueProvider, { storageKey: LAST_USED_LABELS_KEY, defaultValue: [] }, (lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
            var _a;
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1", "data-testid": this.props['data-testid'] },
                    React.createElement("button", { className: "gf-form-label query-keyword pointer", onClick: this.onClickChooserButton, disabled: buttonDisabled, type: "button" },
                        chooserText,
                        React.createElement(Icon, { name: labelBrowserVisible ? 'angle-down' : 'angle-right' })),
                    React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1 min-width-15" },
                        React.createElement(MonacoQueryFieldWrapper, { languageProvider: languageProvider, history: history, onChange: this.onChangeQuery, onRunQuery: this.props.onRunQuery, initialValue: (_a = query.expr) !== null && _a !== void 0 ? _a : '', placeholder: "Enter a PromQL query\u2026" }))),
                labelBrowserVisible && (React.createElement("div", { className: "gf-form" },
                    React.createElement(PrometheusMetricsBrowser, { languageProvider: languageProvider, onChange: this.onChangeLabelBrowser, lastUsedLabels: lastUsedLabels || [], storeLastUsedLabels: onLastUsedLabelsSave, deleteLastUsedLabels: onLastUsedLabelsDelete }))),
                ExtraFieldElement,
                hint ? (React.createElement("div", { className: "query-row-break" },
                    React.createElement("div", { className: "prom-query-field-info text-warning" },
                        hint.label,
                        ' ',
                        hint.fix ? (React.createElement("button", { type: "button", className: cx(clearButtonStyles(theme), 'text-link', 'muted'), onClick: this.onClickHintFix }, hint.fix.label)) : null))) : null));
        }));
    }
}
export default withTheme2(PromQueryField);
//# sourceMappingURL=PromQueryField.js.map