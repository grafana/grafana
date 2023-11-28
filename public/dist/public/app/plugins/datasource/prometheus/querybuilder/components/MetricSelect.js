import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useState } from 'react';
import Highlighter from 'react-highlight-words';
import { toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { AsyncSelect, Button, CustomScrollbar, getSelectStyles, Icon, InlineField, InlineFieldRow, useStyles2, useTheme2, } from '@grafana/ui';
import { SelectMenuOptions } from '@grafana/ui/src/components/Select/SelectMenu';
import { truncateResult } from '../../language_utils';
import { regexifyLabelValuesQueryString } from '../shared/parsingUtils';
import { MetricsModal } from './metrics-modal/MetricsModal';
import { tracking } from './metrics-modal/state/helpers';
// We are matching words split with space
const splitSeparator = ' ';
export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;
export function MetricSelect({ datasource, query, onChange, onGetMetrics, labelsFilters, metricLookupDisabled, onBlur, variableEditor, }) {
    var _a;
    const styles = useStyles2(getStyles);
    const [state, setState] = useState({});
    const prometheusMetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;
    const metricsModalOption = [
        {
            value: 'BrowseMetrics',
            label: 'Metrics explorer',
            description: 'Browse and filter all metrics and metadata with a fuzzy search',
        },
    ];
    const customFilterOption = useCallback((option, searchQuery) => {
        var _a;
        const label = (_a = option.label) !== null && _a !== void 0 ? _a : option.value;
        if (!label) {
            return false;
        }
        // custom value is not a string label but a react node
        if (!label.toLowerCase) {
            return true;
        }
        const searchWords = searchQuery.split(splitSeparator);
        return searchWords.reduce((acc, cur) => {
            const matcheSearch = label.toLowerCase().includes(cur.toLowerCase());
            let browseOption = false;
            if (prometheusMetricEncyclopedia) {
                browseOption = label === 'Metrics explorer';
            }
            return acc && (matcheSearch || browseOption);
        }, true);
    }, [prometheusMetricEncyclopedia]);
    const formatOptionLabel = useCallback((option, meta) => {
        var _a;
        // For newly created custom value we don't want to add highlight
        if (option['__isNew__']) {
            return option.label;
        }
        // only matches on input, does not match on regex
        // look into matching for regex input
        return (React.createElement(Highlighter, { searchWords: meta.inputValue.split(splitSeparator), textToHighlight: (_a = option.label) !== null && _a !== void 0 ? _a : '', highlightClassName: styles.highlight }));
    }, [styles.highlight]);
    /**
     * Reformat the query string and label filters to return all valid results for current query editor state
     */
    const formatKeyValueStringsForLabelValuesQuery = (query, labelsFilters) => {
        const queryString = regexifyLabelValuesQueryString(query);
        return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
    };
    /**
     * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
     */
    const getMetricLabels = (query) => {
        // Since some customers can have millions of metrics, whenever the user changes the autocomplete text we want to call the backend and request all metrics that match the current query string
        const results = datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));
        return results.then((results) => {
            const resultsLength = results.length;
            truncateResult(results);
            if (resultsLength > results.length) {
                setState(Object.assign(Object.assign({}, state), { resultsTruncated: true }));
            }
            else {
                setState(Object.assign(Object.assign({}, state), { resultsTruncated: false }));
            }
            const resultsOptions = results.map((result) => {
                return {
                    label: result.text,
                    value: result.text,
                };
            });
            if (prometheusMetricEncyclopedia) {
                return [...metricsModalOption, ...resultsOptions];
            }
            else {
                return resultsOptions;
            }
        });
    };
    // When metric and label lookup is disabled we won't request labels
    const metricLookupDisabledSearch = () => Promise.resolve([]);
    const debouncedSearch = debounce((query) => getMetricLabels(query), datasource.getDebounceTimeInMilliseconds());
    // No type found for the common select props so typing as any
    // https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Select/SelectBase.tsx/#L212-L263
    // eslint-disable-next-line
    const CustomOption = (props) => {
        const option = props.data;
        if (option.value === 'BrowseMetrics') {
            const isFocused = props.isFocused ? styles.focus : '';
            return (
            // TODO: fix keyboard a11y
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            React.createElement("div", Object.assign({}, props.innerProps, { ref: props.innerRef, className: `${styles.customOptionWidth} metric-encyclopedia-open`, onKeyDown: (e) => {
                    // if there is no metric and the m.e. is enabled, open the modal
                    if (e.code === 'Enter') {
                        setState(Object.assign(Object.assign({}, state), { metricsModalOpen: true }));
                    }
                } }), React.createElement("div", { className: `${styles.customOption} ${isFocused} metric-encyclopedia-open` },
                React.createElement("div", null,
                    React.createElement("div", { className: "metric-encyclopedia-open" }, option.label),
                    React.createElement("div", { className: `${styles.customOptionDesc} metric-encyclopedia-open` }, option.description)),
                React.createElement(Button, { fill: "text", size: "sm", variant: "secondary", onClick: () => setState(Object.assign(Object.assign({}, state), { metricsModalOpen: true })), className: "metric-encyclopedia-open" },
                    "Open",
                    React.createElement(Icon, { name: "arrow-right" })))));
        }
        return SelectMenuOptions(props);
    };
    const CustomMenu = ({ children, maxHeight, innerRef, innerProps }) => {
        const theme = useTheme2();
        const stylesMenu = getSelectStyles(theme);
        // Show the results trucated warning only if the options are loaded and the results are truncated
        // The children are a react node(options loading node) or an array(not a valid element)
        const optionsLoaded = !React.isValidElement(children) && state.resultsTruncated;
        return (React.createElement("div", Object.assign({}, innerProps, { className: `${stylesMenu.menu} ${styles.customMenuContainer}`, style: { maxHeight }, "aria-label": "Select options menu" }),
            React.createElement(CustomScrollbar, { scrollRefCallback: innerRef, autoHide: false, autoHeightMax: "inherit", hideHorizontalTrack: true }, children),
            optionsLoaded && (React.createElement("div", { className: styles.customMenuFooter },
                React.createElement("div", null, "Only the top 1000 metrics are displayed in the metric select. Use the metrics explorer to view all metrics.")))));
    };
    const asyncSelect = () => {
        return (React.createElement(AsyncSelect, { isClearable: variableEditor ? true : false, inputId: "prometheus-metric-select", className: styles.select, value: query.metric ? toOption(query.metric) : undefined, placeholder: 'Select metric', allowCustomValue: true, formatOptionLabel: formatOptionLabel, filterOption: customFilterOption, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
                if (metricLookupDisabled) {
                    return;
                }
                setState({ isLoading: true });
                const metrics = yield onGetMetrics();
                const initialMetrics = metrics.map((m) => m.value);
                const resultsLength = metrics.length;
                if (metrics.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
                    truncateResult(metrics);
                }
                if (prometheusMetricEncyclopedia) {
                    setState({
                        // add the modal butoon option to the options
                        metrics: [...metricsModalOption, ...metrics],
                        isLoading: undefined,
                        // pass the initial metrics into the metrics explorer
                        initialMetrics: initialMetrics,
                        resultsTruncated: resultsLength > metrics.length,
                    });
                }
                else {
                    setState({
                        metrics,
                        isLoading: undefined,
                        resultsTruncated: resultsLength > metrics.length,
                    });
                }
            }), loadOptions: metricLookupDisabled ? metricLookupDisabledSearch : debouncedSearch, isLoading: state.isLoading, defaultOptions: state.metrics, onChange: (input) => {
                const value = input === null || input === void 0 ? void 0 : input.value;
                if (value) {
                    // if there is no metric and the m.e. is enabled, open the modal
                    if (prometheusMetricEncyclopedia && value === 'BrowseMetrics') {
                        tracking('grafana_prometheus_metric_encyclopedia_open', null, '', query);
                        setState(Object.assign(Object.assign({}, state), { metricsModalOpen: true }));
                    }
                    else {
                        onChange(Object.assign(Object.assign({}, query), { metric: value }));
                    }
                }
                else {
                    onChange(Object.assign(Object.assign({}, query), { metric: '' }));
                }
            }, components: prometheusMetricEncyclopedia ? { Option: CustomOption, MenuList: CustomMenu } : { MenuList: CustomMenu }, onBlur: onBlur ? onBlur : () => { } }));
    };
    return (React.createElement(React.Fragment, null,
        prometheusMetricEncyclopedia && !datasource.lookupsDisabled && state.metricsModalOpen && (React.createElement(MetricsModal, { datasource: datasource, isOpen: state.metricsModalOpen, onClose: () => setState(Object.assign(Object.assign({}, state), { metricsModalOpen: false })), query: query, onChange: onChange, initialMetrics: (_a = state.initialMetrics) !== null && _a !== void 0 ? _a : [] })),
        variableEditor ? (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Metric", labelWidth: 20, tooltip: React.createElement("div", null, "Optional: returns a list of label values for the label name in the specified metric.") }, asyncSelect()))) : (React.createElement(EditorFieldGroup, null,
            React.createElement(EditorField, { label: "Metric" }, asyncSelect())))));
}
const getStyles = (theme) => ({
    select: css `
    min-width: 125px;
  `,
    highlight: css `
    label: select__match-highlight;
    background: inherit;
    padding: inherit;
    color: ${theme.colors.warning.contrastText};
    background-color: ${theme.colors.warning.main};
  `,
    customOption: css `
    padding: 8px;
    display: flex;
    justify-content: space-between;
    cursor: pointer;
    :hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.primary, 0.1)};
    }
  `,
    customOptionlabel: css `
    color: ${theme.colors.text.primary};
  `,
    customOptionDesc: css `
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.xs};
    opacity: 50%;
  `,
    focus: css `
    background-color: ${theme.colors.emphasize(theme.colors.background.primary, 0.1)};
  `,
    customOptionWidth: css `
    min-width: 400px;
  `,
    customMenuFooter: css `
    flex: 0;
    display: flex;
    justify-content: space-between;
    padding: ${theme.spacing(1.5)};
    border-top: 1px solid ${theme.colors.border.weak};
    color: ${theme.colors.text.secondary};
  `,
    customMenuContainer: css `
    display: flex;
    flex-direction: column;
    background: ${theme.colors.background.primary};
    box-shadow: ${theme.shadows.z3};
  `,
});
export const formatPrometheusLabelFiltersToString = (queryString, labelsFilters) => {
    const filterArray = labelsFilters ? formatPrometheusLabelFilters(labelsFilters) : [];
    return `label_values({__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}},__name__)`;
};
export const formatPrometheusLabelFilters = (labelsFilters) => {
    return labelsFilters.map((label) => {
        return `,${label.label}="${label.value}"`;
    });
};
//# sourceMappingURL=MetricSelect.js.map