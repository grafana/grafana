import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { FixedSizeList } from 'react-window';
import { Button, HorizontalGroup, Input, Label, LoadingPlaceholder, stylesFactory, BrowserLabel as PromLabel, withTheme2, } from '@grafana/ui';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../language_utils';
// Hard limit on labels to render
const EMPTY_SELECTOR = '{}';
const METRIC_LABEL = '__name__';
const LIST_ITEM_SIZE = 25;
export function buildSelector(labels) {
    let singleMetric = '';
    const selectedLabels = [];
    for (const label of labels) {
        if ((label.name === METRIC_LABEL || label.selected) && label.values && label.values.length > 0) {
            const selectedValues = label.values.filter((value) => value.selected).map((value) => value.name);
            if (selectedValues.length > 1) {
                selectedLabels.push(`${label.name}=~"${selectedValues.map(escapeLabelValueInRegexSelector).join('|')}"`);
            }
            else if (selectedValues.length === 1) {
                if (label.name === METRIC_LABEL) {
                    singleMetric = selectedValues[0];
                }
                else {
                    selectedLabels.push(`${label.name}="${escapeLabelValueInExactSelector(selectedValues[0])}"`);
                }
            }
        }
    }
    return [singleMetric, '{', selectedLabels.join(','), '}'].join('');
}
export function facetLabels(labels, possibleLabels, lastFacetted) {
    return labels.map((label) => {
        var _a;
        const possibleValues = possibleLabels[label.name];
        if (possibleValues) {
            let existingValues;
            if (label.name === lastFacetted && label.values) {
                // Facetting this label, show all values
                existingValues = label.values;
            }
            else {
                // Keep selection in other facets
                const selectedValues = new Set(((_a = label.values) === null || _a === void 0 ? void 0 : _a.filter((value) => value.selected).map((value) => value.name)) || []);
                // Values for this label have not been requested yet, let's use the facetted ones as the initial values
                existingValues = possibleValues.map((value) => ({ name: value, selected: selectedValues.has(value) }));
            }
            return Object.assign(Object.assign({}, label), { loading: false, values: existingValues, hidden: !possibleValues, facets: existingValues.length });
        }
        // Label is facetted out, hide all values
        return Object.assign(Object.assign({}, label), { loading: false, hidden: !possibleValues, values: undefined, facets: 0 });
    });
}
const getStyles = stylesFactory((theme) => ({
    wrapper: css `
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    width: 100%;
  `,
    list: css `
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-wrap: wrap;
    max-height: 200px;
    overflow: auto;
    align-content: flex-start;
  `,
    section: css `
    & + & {
      margin: ${theme.spacing(2)} 0;
    }
    position: relative;
  `,
    selector: css `
    font-family: ${theme.typography.fontFamilyMonospace};
    margin-bottom: ${theme.spacing(1)};
  `,
    status: css `
    padding: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* using absolute positioning because flex interferes with ellipsis */
    position: absolute;
    width: 50%;
    right: 0;
    text-align: right;
    transition: opacity 100ms linear;
    opacity: 0;
  `,
    statusShowing: css `
    opacity: 1;
  `,
    error: css `
    color: ${theme.colors.error.main};
  `,
    valueList: css `
    margin-right: ${theme.spacing(1)};
    resize: horizontal;
  `,
    valueListWrapper: css `
    border-left: 1px solid ${theme.colors.border.medium};
    margin: ${theme.spacing(1)} 0;
    padding: ${theme.spacing(1)} 0 ${theme.spacing(1)} ${theme.spacing(1)};
  `,
    valueListArea: css `
    display: flex;
    flex-wrap: wrap;
    margin-top: ${theme.spacing(1)};
  `,
    valueTitle: css `
    margin-left: -${theme.spacing(0.5)};
    margin-bottom: ${theme.spacing(1)};
  `,
    validationStatus: css `
    padding: ${theme.spacing(0.5)};
    margin-bottom: ${theme.spacing(1)};
    color: ${theme.colors.text.maxContrast};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
}));
/**
 * TODO #33976: Remove duplicated code. The component is very similar to LokiLabelBrowser.tsx. Check if it's possible
 *              to create a single, generic component.
 */
export class UnthemedPrometheusMetricsBrowser extends React.Component {
    constructor() {
        super(...arguments);
        this.valueListsRef = React.createRef();
        this.state = {
            labels: [],
            labelSearchTerm: '',
            metricSearchTerm: '',
            status: 'Ready',
            error: '',
            validationStatus: '',
            valueSearchTerm: '',
        };
        this.onChangeLabelSearch = (event) => {
            this.setState({ labelSearchTerm: event.target.value });
        };
        this.onChangeMetricSearch = (event) => {
            this.setState({ metricSearchTerm: event.target.value });
        };
        this.onChangeValueSearch = (event) => {
            this.setState({ valueSearchTerm: event.target.value });
        };
        this.onClickRunQuery = () => {
            const selector = buildSelector(this.state.labels);
            this.props.onChange(selector);
        };
        this.onClickRunRateQuery = () => {
            const selector = buildSelector(this.state.labels);
            const query = `rate(${selector}[$__rate_interval])`;
            this.props.onChange(query);
        };
        this.onClickClear = () => {
            this.setState((state) => {
                const labels = state.labels.map((label) => (Object.assign(Object.assign({}, label), { values: undefined, selected: false, loading: false, hidden: false, facets: undefined })));
                return {
                    labels,
                    labelSearchTerm: '',
                    metricSearchTerm: '',
                    status: '',
                    error: '',
                    validationStatus: '',
                    valueSearchTerm: '',
                };
            });
            this.props.deleteLastUsedLabels();
            // Get metrics
            this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
        };
        this.onClickLabel = (name, value, event) => {
            const label = this.state.labels.find((l) => l.name === name);
            if (!label) {
                return;
            }
            // Toggle selected state
            const selected = !label.selected;
            let nextValue = { selected };
            if (label.values && !selected) {
                // Deselect all values if label was deselected
                const values = label.values.map((value) => (Object.assign(Object.assign({}, value), { selected: false })));
                nextValue = Object.assign(Object.assign({}, nextValue), { facets: 0, values });
            }
            // Resetting search to prevent empty results
            this.setState({ labelSearchTerm: '' });
            this.updateLabelState(name, nextValue, '', () => this.doFacettingForLabel(name));
        };
        this.onClickValue = (name, value, event) => {
            const label = this.state.labels.find((l) => l.name === name);
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            this.setState({ labelSearchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            const values = label.values.map((v) => (Object.assign(Object.assign({}, v), { selected: v.name === value ? !v.selected : v.selected })));
            this.updateLabelState(name, { values }, '', () => this.doFacetting(name));
        };
        this.onClickMetric = (name, value, event) => {
            // Finding special metric label
            const label = this.state.labels.find((l) => l.name === name);
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            this.setState({ metricSearchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            const values = label.values.map((v) => (Object.assign(Object.assign({}, v), { selected: v.name === value || v.selected ? !v.selected : v.selected })));
            // Toggle selected state of special metrics label
            const selected = values.some((v) => v.selected);
            this.updateLabelState(name, { selected, values }, '', () => this.doFacetting(name));
        };
        this.onClickValidate = () => {
            const selector = buildSelector(this.state.labels);
            this.validateSelector(selector);
        };
        this.doFacetting = (lastFacetted) => {
            const selector = buildSelector(this.state.labels);
            if (selector === EMPTY_SELECTOR) {
                // Clear up facetting
                const labels = this.state.labels.map((label) => {
                    return Object.assign(Object.assign({}, label), { facets: 0, values: undefined, hidden: false });
                });
                this.setState({ labels }, () => {
                    // Get fresh set of values
                    this.state.labels.forEach((label) => (label.selected || label.name === METRIC_LABEL) && this.fetchValues(label.name, selector));
                });
            }
            else {
                // Do facetting
                this.fetchSeries(selector, lastFacetted);
            }
        };
    }
    updateLabelState(name, updatedFields, status = '', cb) {
        this.setState((state) => {
            const labels = state.labels.map((label) => {
                if (label.name === name) {
                    return Object.assign(Object.assign({}, label), updatedFields);
                }
                return label;
            });
            // New status overrides errors
            const error = status ? '' : state.error;
            return { labels, status, error, validationStatus: '' };
        }, cb);
    }
    componentDidMount() {
        const { languageProvider, lastUsedLabels } = this.props;
        if (languageProvider) {
            const selectedLabels = lastUsedLabels;
            languageProvider.start().then(() => {
                let rawLabels = languageProvider.getLabelKeys();
                // Get metrics
                this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
                // Auto-select previously selected labels
                const labels = rawLabels.map((label, i, arr) => ({
                    name: label,
                    selected: selectedLabels.includes(label),
                    loading: false,
                }));
                // Pre-fetch values for selected labels
                this.setState({ labels }, () => {
                    this.state.labels.forEach((label) => {
                        if (label.selected) {
                            this.fetchValues(label.name, EMPTY_SELECTOR);
                        }
                    });
                });
            });
        }
    }
    doFacettingForLabel(name) {
        const label = this.state.labels.find((l) => l.name === name);
        if (!label) {
            return;
        }
        const selectedLabels = this.state.labels.filter((label) => label.selected).map((label) => label.name);
        this.props.storeLastUsedLabels(selectedLabels);
        if (label.selected) {
            // Refetch values for newly selected label...
            if (!label.values) {
                this.fetchValues(name, buildSelector(this.state.labels));
            }
        }
        else {
            // Only need to facet when deselecting labels
            this.doFacetting();
        }
    }
    fetchValues(name, selector) {
        return __awaiter(this, void 0, void 0, function* () {
            const { languageProvider } = this.props;
            this.updateLabelState(name, { loading: true }, `Fetching values for ${name}`);
            try {
                let rawValues = yield languageProvider.getLabelValues(name);
                // If selector changed, clear loading state and discard result by returning early
                if (selector !== buildSelector(this.state.labels)) {
                    this.updateLabelState(name, { loading: false });
                    return;
                }
                const values = [];
                const { metricsMetadata } = languageProvider;
                for (const labelValue of rawValues) {
                    const value = { name: labelValue };
                    // Adding type/help text to metrics
                    if (name === METRIC_LABEL && metricsMetadata) {
                        const meta = metricsMetadata[labelValue];
                        if (meta) {
                            value.details = `(${meta.type}) ${meta.help}`;
                        }
                    }
                    values.push(value);
                }
                this.updateLabelState(name, { values, loading: false });
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    fetchSeries(selector, lastFacetted) {
        return __awaiter(this, void 0, void 0, function* () {
            const { languageProvider } = this.props;
            if (lastFacetted) {
                this.updateLabelState(lastFacetted, { loading: true }, `Facetting labels for ${selector}`);
            }
            try {
                const possibleLabels = yield languageProvider.fetchSeriesLabels(selector, true);
                // If selector changed, clear loading state and discard result by returning early
                if (selector !== buildSelector(this.state.labels)) {
                    if (lastFacetted) {
                        this.updateLabelState(lastFacetted, { loading: false });
                    }
                    return;
                }
                if (Object.keys(possibleLabels).length === 0) {
                    this.setState({ error: `Empty results, no matching label for ${selector}` });
                    return;
                }
                const labels = facetLabels(this.state.labels, possibleLabels, lastFacetted);
                this.setState({ labels, error: '' });
                if (lastFacetted) {
                    this.updateLabelState(lastFacetted, { loading: false });
                }
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    validateSelector(selector) {
        return __awaiter(this, void 0, void 0, function* () {
            const { languageProvider } = this.props;
            this.setState({ validationStatus: `Validating selector ${selector}`, error: '' });
            const streams = yield languageProvider.fetchSeries(selector);
            this.setState({ validationStatus: `Selector is valid (${streams.length} series found)` });
        });
    }
    render() {
        var _a, _b;
        const { theme } = this.props;
        const { labels, labelSearchTerm, metricSearchTerm, status, error, validationStatus, valueSearchTerm } = this.state;
        const styles = getStyles(theme);
        if (labels.length === 0) {
            return (React.createElement("div", { className: styles.wrapper },
                React.createElement(LoadingPlaceholder, { text: "Loading labels..." })));
        }
        // Filter metrics
        let metrics = labels.find((label) => label.name === METRIC_LABEL);
        if (metrics && metricSearchTerm) {
            metrics = Object.assign(Object.assign({}, metrics), { values: (_a = metrics.values) === null || _a === void 0 ? void 0 : _a.filter((value) => value.selected || value.name.includes(metricSearchTerm)) });
        }
        // Filter labels
        let nonMetricLabels = labels.filter((label) => !label.hidden && label.name !== METRIC_LABEL);
        if (labelSearchTerm) {
            nonMetricLabels = nonMetricLabels.filter((label) => label.selected || label.name.includes(labelSearchTerm));
        }
        // Filter non-metric label values
        let selectedLabels = nonMetricLabels.filter((label) => label.selected && label.values);
        if (valueSearchTerm) {
            selectedLabels = selectedLabels.map((label) => {
                var _a;
                return (Object.assign(Object.assign({}, label), { values: (_a = label.values) === null || _a === void 0 ? void 0 : _a.filter((value) => value.selected || value.name.includes(valueSearchTerm)) }));
            });
        }
        const selector = buildSelector(this.state.labels);
        const empty = selector === EMPTY_SELECTOR;
        const metricCount = ((_b = metrics === null || metrics === void 0 ? void 0 : metrics.values) === null || _b === void 0 ? void 0 : _b.length) || 0;
        return (React.createElement("div", { className: styles.wrapper },
            React.createElement(HorizontalGroup, { align: "flex-start", spacing: "lg" },
                React.createElement("div", null,
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Once a metric is selected only possible labels are shown." }, "1. Select a metric"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeMetricSearch, "aria-label": "Filter expression for metric", value: metricSearchTerm })),
                        React.createElement("div", { role: "list", className: styles.valueListWrapper },
                            React.createElement(FixedSizeList, { height: Math.min(450, metricCount * LIST_ITEM_SIZE), itemCount: metricCount, itemSize: LIST_ITEM_SIZE, itemKey: (i) => metrics.values[i].name, width: 300, className: styles.valueList }, ({ index, style }) => {
                                var _a;
                                const value = (_a = metrics === null || metrics === void 0 ? void 0 : metrics.values) === null || _a === void 0 ? void 0 : _a[index];
                                if (!value) {
                                    return null;
                                }
                                return (React.createElement("div", { style: style },
                                    React.createElement(PromLabel, { name: metrics.name, value: value === null || value === void 0 ? void 0 : value.name, title: value.details, active: value === null || value === void 0 ? void 0 : value.selected, onClick: this.onClickMetric, searchTerm: metricSearchTerm })));
                            })))),
                React.createElement("div", null,
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Once label values are selected, only possible label combinations are shown." }, "2. Select labels to search in"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeLabelSearch, "aria-label": "Filter expression for label", value: labelSearchTerm })),
                        React.createElement("div", { className: styles.list, style: { height: 120 } }, nonMetricLabels.map((label) => (React.createElement(PromLabel, { key: label.name, name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, facets: label.facets, onClick: this.onClickLabel, searchTerm: labelSearchTerm }))))),
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Use the search field to find values across selected labels." }, "3. Select (multiple) values for your labels"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeValueSearch, "aria-label": "Filter expression for label values", value: valueSearchTerm })),
                        React.createElement("div", { className: styles.valueListArea, ref: this.valueListsRef }, selectedLabels.map((label) => {
                            var _a, _b, _c;
                            return (React.createElement("div", { role: "list", key: label.name, "aria-label": `Values for ${label.name}`, className: styles.valueListWrapper },
                                React.createElement("div", { className: styles.valueTitle },
                                    React.createElement(PromLabel, { name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, 
                                        //If no facets, we want to show number of all label values
                                        facets: label.facets || ((_a = label.values) === null || _a === void 0 ? void 0 : _a.length), onClick: this.onClickLabel })),
                                React.createElement(FixedSizeList, { height: Math.min(200, LIST_ITEM_SIZE * (((_b = label.values) === null || _b === void 0 ? void 0 : _b.length) || 0)), itemCount: ((_c = label.values) === null || _c === void 0 ? void 0 : _c.length) || 0, itemSize: 28, itemKey: (i) => label.values[i].name, width: 200, className: styles.valueList }, ({ index, style }) => {
                                    var _a;
                                    const value = (_a = label.values) === null || _a === void 0 ? void 0 : _a[index];
                                    if (!value) {
                                        return null;
                                    }
                                    return (React.createElement("div", { style: style },
                                        React.createElement(PromLabel, { name: label.name, value: value === null || value === void 0 ? void 0 : value.name, active: value === null || value === void 0 ? void 0 : value.selected, onClick: this.onClickValue, searchTerm: valueSearchTerm })));
                                })));
                        }))))),
            React.createElement("div", { className: styles.section },
                React.createElement(Label, null, "4. Resulting selector"),
                React.createElement("div", { "aria-label": "selector", className: styles.selector }, selector),
                validationStatus && React.createElement("div", { className: styles.validationStatus }, validationStatus),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { "aria-label": "Use selector for query button", disabled: empty, onClick: this.onClickRunQuery }, "Use query"),
                    React.createElement(Button, { "aria-label": "Use selector as metrics button", variant: "secondary", disabled: empty, onClick: this.onClickRunRateQuery }, "Use as rate query"),
                    React.createElement(Button, { "aria-label": "Validate submit button", variant: "secondary", disabled: empty, onClick: this.onClickValidate }, "Validate selector"),
                    React.createElement(Button, { "aria-label": "Selector clear button", variant: "secondary", onClick: this.onClickClear }, "Clear"),
                    React.createElement("div", { className: cx(styles.status, (status || error) && styles.statusShowing) },
                        React.createElement("span", { className: error ? styles.error : '' }, error || status))))));
    }
}
export const PrometheusMetricsBrowser = withTheme2(UnthemedPrometheusMetricsBrowser);
//# sourceMappingURL=PrometheusMetricsBrowser.js.map