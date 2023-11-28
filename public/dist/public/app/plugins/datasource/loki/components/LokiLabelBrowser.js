import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React from 'react';
import { FixedSizeList } from 'react-window';
import { reportInteraction } from '@grafana/runtime';
import { Button, HorizontalGroup, Input, Label, LoadingPlaceholder, withTheme2, BrowserLabel as LokiLabel, fuzzyMatch, } from '@grafana/ui';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../languageUtils';
// Hard limit on labels to render
const MAX_LABEL_COUNT = 1000;
const MAX_VALUE_COUNT = 10000;
const MAX_AUTO_SELECT = 4;
const EMPTY_SELECTOR = '{}';
export function buildSelector(labels) {
    const selectedLabels = [];
    for (const label of labels) {
        if (label.selected && label.values && label.values.length > 0) {
            const selectedValues = label.values.filter((value) => value.selected).map((value) => value.name);
            if (selectedValues.length > 1) {
                selectedLabels.push(`${label.name}=~"${selectedValues.map(escapeLabelValueInRegexSelector).join('|')}"`);
            }
            else if (selectedValues.length === 1) {
                selectedLabels.push(`${label.name}="${escapeLabelValueInExactSelector(selectedValues[0])}"`);
            }
        }
    }
    return ['{', selectedLabels.join(','), '}'].join('');
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
            return Object.assign(Object.assign({}, label), { loading: false, values: existingValues, facets: existingValues.length });
        }
        // Label is facetted out, hide all values
        return Object.assign(Object.assign({}, label), { loading: false, hidden: !possibleValues, values: undefined, facets: 0 });
    });
}
const getStyles = (theme) => ({
    wrapper: css `
    background-color: ${theme.colors.background.secondary};
    width: 100%;
  `,
    wrapperPadding: css `
    padding: ${theme.spacing(2)};
  `,
    list: css `
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-wrap: wrap;
    max-height: 200px;
    overflow: auto;
  `,
    section: css `
    & + & {
      margin: ${theme.spacing(2, 0)};
    }

    position: relative;
  `,
    footerSectionStyles: css `
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
    position: sticky;
    bottom: -${theme.spacing(3)}; /* offset the padding on modal */
    left: 0;
  `,
    selector: css `
    font-family: ${theme.typography.fontFamilyMonospace};
    margin-bottom: ${theme.spacing(1)};
    width: 100%;
  `,
    status: css `
    margin-bottom: ${theme.spacing(1)};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 100ms linear;
    opacity: 0;
    font-size: ${theme.typography.bodySmall.fontSize};
    height: calc(${theme.typography.bodySmall.fontSize} + 10px);
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
    margin: ${theme.spacing(1, 0)};
    padding: ${theme.spacing(1, 0, 1, 1)};
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
});
export class UnthemedLokiLabelBrowser extends React.Component {
    constructor() {
        super(...arguments);
        this.state = {
            labels: [],
            searchTerm: '',
            status: 'Ready',
            error: '',
            validationStatus: '',
        };
        this.onChangeSearch = (event) => {
            this.setState({ searchTerm: event.target.value });
        };
        this.onClickRunLogsQuery = () => {
            reportInteraction('grafana_loki_label_browser_closed', {
                app: this.props.app,
                closeType: 'showLogsButton',
            });
            const selector = buildSelector(this.state.labels);
            this.props.onChange(selector);
        };
        this.onClickRunMetricsQuery = () => {
            reportInteraction('grafana_loki_label_browser_closed', {
                app: this.props.app,
                closeType: 'showLogsRateButton',
            });
            const selector = buildSelector(this.state.labels);
            const query = `rate(${selector}[$__auto])`;
            this.props.onChange(query);
        };
        this.onClickClear = () => {
            this.setState((state) => {
                const labels = state.labels.map((label) => (Object.assign(Object.assign({}, label), { values: undefined, selected: false, loading: false, hidden: false, facets: undefined })));
                return { labels, searchTerm: '', status: '', error: '', validationStatus: '' };
            });
            this.props.deleteLastUsedLabels();
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
            this.setState({ searchTerm: '' });
            this.updateLabelState(name, nextValue, '', () => this.doFacettingForLabel(name));
        };
        this.onClickValue = (name, value, event) => {
            const label = this.state.labels.find((l) => l.name === name);
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            this.setState({ searchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            const values = label.values.map((v) => (Object.assign(Object.assign({}, v), { selected: v.name === value ? !v.selected : v.selected })));
            this.updateLabelState(name, { values }, '', () => this.doFacetting(name));
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
                    this.state.labels.forEach((label) => label.selected && this.fetchValues(label.name, selector));
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
        const { languageProvider, autoSelect = MAX_AUTO_SELECT, lastUsedLabels } = this.props;
        if (languageProvider) {
            const selectedLabels = lastUsedLabels;
            languageProvider.start().then(() => {
                let rawLabels = languageProvider.getLabelKeys();
                if (rawLabels.length > MAX_LABEL_COUNT) {
                    const error = `Too many labels found (showing only ${MAX_LABEL_COUNT} of ${rawLabels.length})`;
                    rawLabels = rawLabels.slice(0, MAX_LABEL_COUNT);
                    this.setState({ error });
                }
                // Auto-select all labels if label list is small enough
                const labels = rawLabels.map((label, i, arr) => ({
                    name: label,
                    selected: (arr.length <= autoSelect && selectedLabels.length === 0) || selectedLabels.includes(label),
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
                    this.updateLabelState(name, { loading: false }, '');
                    return;
                }
                if (rawValues.length > MAX_VALUE_COUNT) {
                    const error = `Too many values for ${name} (showing only ${MAX_VALUE_COUNT} of ${rawValues.length})`;
                    rawValues = rawValues.slice(0, MAX_VALUE_COUNT);
                    this.setState({ error });
                }
                const values = rawValues.map((value) => ({ name: value }));
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
                this.updateLabelState(lastFacetted, { loading: true }, `Loading labels for ${selector}`);
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
            this.setState({ validationStatus: `Selector is valid (${streams.length} streams found)` });
        });
    }
    render() {
        const { theme } = this.props;
        const { labels, searchTerm, status, error, validationStatus } = this.state;
        if (labels.length === 0) {
            return React.createElement(LoadingPlaceholder, { text: "Loading labels..." });
        }
        const styles = getStyles(theme);
        const selector = buildSelector(this.state.labels);
        const empty = selector === EMPTY_SELECTOR;
        let selectedLabels = labels.filter((label) => label.selected && label.values);
        if (searchTerm) {
            selectedLabels = selectedLabels.map((label) => {
                const searchResults = label.values.filter((value) => {
                    // Always return selected values
                    if (value.selected) {
                        value.highlightParts = undefined;
                        return true;
                    }
                    const fuzzyMatchResult = fuzzyMatch(value.name.toLowerCase(), searchTerm.toLowerCase());
                    if (fuzzyMatchResult.found) {
                        value.highlightParts = fuzzyMatchResult.ranges;
                        value.order = fuzzyMatchResult.distance;
                        return true;
                    }
                    else {
                        return false;
                    }
                });
                return Object.assign(Object.assign({}, label), { values: sortBy(searchResults, (value) => (value.selected ? -Infinity : value.order)) });
            });
        }
        else {
            // Clear highlight parts when searchTerm is cleared
            selectedLabels = this.state.labels
                .filter((label) => label.selected && label.values)
                .map((label) => (Object.assign(Object.assign({}, label), { values: (label === null || label === void 0 ? void 0 : label.values) ? label.values.map((value) => (Object.assign(Object.assign({}, value), { highlightParts: undefined }))) : [] })));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.wrapper },
                React.createElement("div", { className: cx(styles.section, styles.wrapperPadding) },
                    React.createElement(Label, { description: "Which labels would you like to consider for your search?" }, "1. Select labels to search in"),
                    React.createElement("div", { className: styles.list }, labels.map((label) => (React.createElement(LokiLabel, { key: label.name, name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, facets: label.facets, onClick: this.onClickLabel }))))),
                React.createElement("div", { className: cx(styles.section, styles.wrapperPadding) },
                    React.createElement(Label, { description: "Choose the label values that you would like to use for the query. Use the search field to find values across selected labels." }, "2. Find values for the selected labels"),
                    React.createElement("div", null,
                        React.createElement(Input, { onChange: this.onChangeSearch, "aria-label": "Filter expression for values", value: searchTerm, placeholder: 'Enter a label value' })),
                    React.createElement("div", { className: styles.valueListArea }, selectedLabels.map((label) => {
                        var _a, _b;
                        return (React.createElement("div", { role: "list", key: label.name, className: styles.valueListWrapper },
                            React.createElement("div", { className: styles.valueTitle, "aria-label": `Values for ${label.name}` },
                                React.createElement(LokiLabel, { name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, 
                                    //If no facets, we want to show number of all label values
                                    facets: label.facets || ((_a = label.values) === null || _a === void 0 ? void 0 : _a.length), onClick: this.onClickLabel })),
                            React.createElement(FixedSizeList, { height: 200, itemCount: ((_b = label.values) === null || _b === void 0 ? void 0 : _b.length) || 0, itemSize: 28, itemKey: (i) => label.values[i].name, width: 200, className: styles.valueList }, ({ index, style }) => {
                                var _a;
                                const value = (_a = label.values) === null || _a === void 0 ? void 0 : _a[index];
                                if (!value) {
                                    return null;
                                }
                                return (React.createElement("div", { style: style },
                                    React.createElement(LokiLabel, { name: label.name, value: value === null || value === void 0 ? void 0 : value.name, active: value === null || value === void 0 ? void 0 : value.selected, highlightParts: value === null || value === void 0 ? void 0 : value.highlightParts, onClick: this.onClickValue, searchTerm: searchTerm })));
                            })));
                    })))),
            React.createElement("div", { className: styles.footerSectionStyles },
                React.createElement(Label, null, "3. Resulting selector"),
                React.createElement("pre", { "aria-label": "selector", className: styles.selector }, selector),
                validationStatus && React.createElement("div", { className: styles.validationStatus }, validationStatus),
                React.createElement("div", { className: cx(styles.status, (status || error) && styles.statusShowing) },
                    React.createElement("span", { className: error ? styles.error : '' }, error || status)),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { "aria-label": "Use selector as logs button", disabled: empty, onClick: this.onClickRunLogsQuery }, "Show logs"),
                    React.createElement(Button, { "aria-label": "Use selector as metrics button", variant: "secondary", disabled: empty, onClick: this.onClickRunMetricsQuery }, "Show logs rate"),
                    React.createElement(Button, { "aria-label": "Validate submit button", variant: "secondary", disabled: empty, onClick: this.onClickValidate }, "Validate selector"),
                    React.createElement(Button, { "aria-label": "Selector clear button", variant: "secondary", onClick: this.onClickClear }, "Clear")))));
    }
}
export const LokiLabelBrowser = withTheme2(UnthemedLokiLabelBrowser);
//# sourceMappingURL=LokiLabelBrowser.js.map