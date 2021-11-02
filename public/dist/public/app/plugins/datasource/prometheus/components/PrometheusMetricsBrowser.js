import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __values } from "tslib";
import React from 'react';
import { Button, HorizontalGroup, Input, Label, LoadingPlaceholder, stylesFactory, withTheme, BrowserLabel as PromLabel, } from '@grafana/ui';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../language_utils';
import { css, cx } from '@emotion/css';
import { FixedSizeList } from 'react-window';
// Hard limit on labels to render
var EMPTY_SELECTOR = '{}';
var METRIC_LABEL = '__name__';
var LIST_ITEM_SIZE = 25;
export function buildSelector(labels) {
    var e_1, _a;
    var singleMetric = '';
    var selectedLabels = [];
    try {
        for (var labels_1 = __values(labels), labels_1_1 = labels_1.next(); !labels_1_1.done; labels_1_1 = labels_1.next()) {
            var label = labels_1_1.value;
            if ((label.name === METRIC_LABEL || label.selected) && label.values && label.values.length > 0) {
                var selectedValues = label.values.filter(function (value) { return value.selected; }).map(function (value) { return value.name; });
                if (selectedValues.length > 1) {
                    selectedLabels.push(label.name + "=~\"" + selectedValues.map(escapeLabelValueInRegexSelector).join('|') + "\"");
                }
                else if (selectedValues.length === 1) {
                    if (label.name === METRIC_LABEL) {
                        singleMetric = selectedValues[0];
                    }
                    else {
                        selectedLabels.push(label.name + "=\"" + escapeLabelValueInExactSelector(selectedValues[0]) + "\"");
                    }
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (labels_1_1 && !labels_1_1.done && (_a = labels_1.return)) _a.call(labels_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return [singleMetric, '{', selectedLabels.join(','), '}'].join('');
}
export function facetLabels(labels, possibleLabels, lastFacetted) {
    return labels.map(function (label) {
        var _a;
        var possibleValues = possibleLabels[label.name];
        if (possibleValues) {
            var existingValues = void 0;
            if (label.name === lastFacetted && label.values) {
                // Facetting this label, show all values
                existingValues = label.values;
            }
            else {
                // Keep selection in other facets
                var selectedValues_1 = new Set(((_a = label.values) === null || _a === void 0 ? void 0 : _a.filter(function (value) { return value.selected; }).map(function (value) { return value.name; })) || []);
                // Values for this label have not been requested yet, let's use the facetted ones as the initial values
                existingValues = possibleValues.map(function (value) { return ({ name: value, selected: selectedValues_1.has(value) }); });
            }
            return __assign(__assign({}, label), { loading: false, values: existingValues, hidden: !possibleValues, facets: existingValues.length });
        }
        // Label is facetted out, hide all values
        return __assign(__assign({}, label), { loading: false, hidden: !possibleValues, values: undefined, facets: 0 });
    });
}
var getStyles = stylesFactory(function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: ", ";\n    padding: ", ";\n    width: 100%;\n  "], ["\n    background-color: ", ";\n    padding: ", ";\n    width: 100%;\n  "])), theme.colors.bg2, theme.spacing.sm),
    list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-top: ", ";\n    display: flex;\n    flex-wrap: wrap;\n    max-height: 200px;\n    overflow: auto;\n    align-content: flex-start;\n  "], ["\n    margin-top: ", ";\n    display: flex;\n    flex-wrap: wrap;\n    max-height: 200px;\n    overflow: auto;\n    align-content: flex-start;\n  "])), theme.spacing.sm),
    section: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    & + & {\n      margin: ", " 0;\n    }\n    position: relative;\n  "], ["\n    & + & {\n      margin: ", " 0;\n    }\n    position: relative;\n  "])), theme.spacing.md),
    selector: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    font-family: ", ";\n    margin-bottom: ", ";\n  "], ["\n    font-family: ", ";\n    margin-bottom: ", ";\n  "])), theme.typography.fontFamily.monospace, theme.spacing.sm),
    status: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    padding: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    /* using absolute positioning because flex interferes with ellipsis */\n    position: absolute;\n    width: 50%;\n    right: 0;\n    text-align: right;\n    transition: opacity 100ms linear;\n    opacity: 0;\n  "], ["\n    padding: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    /* using absolute positioning because flex interferes with ellipsis */\n    position: absolute;\n    width: 50%;\n    right: 0;\n    text-align: right;\n    transition: opacity 100ms linear;\n    opacity: 0;\n  "])), theme.spacing.xs, theme.colors.textSemiWeak),
    statusShowing: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    opacity: 1;\n  "], ["\n    opacity: 1;\n  "]))),
    error: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.brandDanger),
    valueList: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing.sm),
    valueListWrapper: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    border-left: 1px solid ", ";\n    margin: ", " 0;\n    padding: ", " 0 ", " ", ";\n  "], ["\n    border-left: 1px solid ", ";\n    margin: ", " 0;\n    padding: ", " 0 ", " ", ";\n  "])), theme.colors.border2, theme.spacing.sm, theme.spacing.sm, theme.spacing.sm, theme.spacing.sm),
    valueListArea: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    display: flex;\n    flex-wrap: wrap;\n    margin-top: ", ";\n  "], ["\n    display: flex;\n    flex-wrap: wrap;\n    margin-top: ", ";\n  "])), theme.spacing.sm),
    valueTitle: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    margin-left: -", ";\n    margin-bottom: ", ";\n  "], ["\n    margin-left: -", ";\n    margin-bottom: ", ";\n  "])), theme.spacing.xs, theme.spacing.sm),
    validationStatus: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n    padding: ", ";\n    margin-bottom: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "], ["\n    padding: ", ";\n    margin-bottom: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "])), theme.spacing.xs, theme.spacing.sm, theme.colors.textStrong),
}); });
/**
 * TODO #33976: Remove duplicated code. The component is very similar to LokiLabelBrowser.tsx. Check if it's possible
 *              to create a single, generic component.
 */
var UnthemedPrometheusMetricsBrowser = /** @class */ (function (_super) {
    __extends(UnthemedPrometheusMetricsBrowser, _super);
    function UnthemedPrometheusMetricsBrowser() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.valueListsRef = React.createRef();
        _this.state = {
            labels: [],
            labelSearchTerm: '',
            metricSearchTerm: '',
            status: 'Ready',
            error: '',
            validationStatus: '',
            valueSearchTerm: '',
        };
        _this.onChangeLabelSearch = function (event) {
            _this.setState({ labelSearchTerm: event.target.value });
        };
        _this.onChangeMetricSearch = function (event) {
            _this.setState({ metricSearchTerm: event.target.value });
        };
        _this.onChangeValueSearch = function (event) {
            _this.setState({ valueSearchTerm: event.target.value });
        };
        _this.onClickRunQuery = function () {
            var selector = buildSelector(_this.state.labels);
            _this.props.onChange(selector);
        };
        _this.onClickRunRateQuery = function () {
            var selector = buildSelector(_this.state.labels);
            var query = "rate(" + selector + "[$__interval])";
            _this.props.onChange(query);
        };
        _this.onClickClear = function () {
            _this.setState(function (state) {
                var labels = state.labels.map(function (label) { return (__assign(__assign({}, label), { values: undefined, selected: false, loading: false, hidden: false, facets: undefined })); });
                return {
                    labels: labels,
                    labelSearchTerm: '',
                    metricSearchTerm: '',
                    status: '',
                    error: '',
                    validationStatus: '',
                    valueSearchTerm: '',
                };
            });
            _this.props.deleteLastUsedLabels();
            // Get metrics
            _this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
        };
        _this.onClickLabel = function (name, value, event) {
            var label = _this.state.labels.find(function (l) { return l.name === name; });
            if (!label) {
                return;
            }
            // Toggle selected state
            var selected = !label.selected;
            var nextValue = { selected: selected };
            if (label.values && !selected) {
                // Deselect all values if label was deselected
                var values = label.values.map(function (value) { return (__assign(__assign({}, value), { selected: false })); });
                nextValue = __assign(__assign({}, nextValue), { facets: 0, values: values });
            }
            // Resetting search to prevent empty results
            _this.setState({ labelSearchTerm: '' });
            _this.updateLabelState(name, nextValue, '', function () { return _this.doFacettingForLabel(name); });
        };
        _this.onClickValue = function (name, value, event) {
            var label = _this.state.labels.find(function (l) { return l.name === name; });
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            _this.setState({ labelSearchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            var values = label.values.map(function (v) { return (__assign(__assign({}, v), { selected: v.name === value ? !v.selected : v.selected })); });
            _this.updateLabelState(name, { values: values }, '', function () { return _this.doFacetting(name); });
        };
        _this.onClickMetric = function (name, value, event) {
            // Finding special metric label
            var label = _this.state.labels.find(function (l) { return l.name === name; });
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            _this.setState({ metricSearchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            var values = label.values.map(function (v) { return (__assign(__assign({}, v), { selected: v.name === value || v.selected ? !v.selected : v.selected })); });
            // Toggle selected state of special metrics label
            var selected = values.some(function (v) { return v.selected; });
            _this.updateLabelState(name, { selected: selected, values: values }, '', function () { return _this.doFacetting(name); });
        };
        _this.onClickValidate = function () {
            var selector = buildSelector(_this.state.labels);
            _this.validateSelector(selector);
        };
        _this.doFacetting = function (lastFacetted) {
            var selector = buildSelector(_this.state.labels);
            if (selector === EMPTY_SELECTOR) {
                // Clear up facetting
                var labels = _this.state.labels.map(function (label) {
                    return __assign(__assign({}, label), { facets: 0, values: undefined, hidden: false });
                });
                _this.setState({ labels: labels }, function () {
                    // Get fresh set of values
                    _this.state.labels.forEach(function (label) { return (label.selected || label.name === METRIC_LABEL) && _this.fetchValues(label.name, selector); });
                });
            }
            else {
                // Do facetting
                _this.fetchSeries(selector, lastFacetted);
            }
        };
        return _this;
    }
    UnthemedPrometheusMetricsBrowser.prototype.updateLabelState = function (name, updatedFields, status, cb) {
        if (status === void 0) { status = ''; }
        this.setState(function (state) {
            var labels = state.labels.map(function (label) {
                if (label.name === name) {
                    return __assign(__assign({}, label), updatedFields);
                }
                return label;
            });
            // New status overrides errors
            var error = status ? '' : state.error;
            return { labels: labels, status: status, error: error, validationStatus: '' };
        }, cb);
    };
    UnthemedPrometheusMetricsBrowser.prototype.componentDidMount = function () {
        var _this = this;
        var _a = this.props, languageProvider = _a.languageProvider, lastUsedLabels = _a.lastUsedLabels;
        if (languageProvider) {
            var selectedLabels_1 = lastUsedLabels;
            languageProvider.start().then(function () {
                var rawLabels = languageProvider.getLabelKeys();
                // Get metrics
                _this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
                // Auto-select previously selected labels
                var labels = rawLabels.map(function (label, i, arr) { return ({
                    name: label,
                    selected: selectedLabels_1.includes(label),
                    loading: false,
                }); });
                // Pre-fetch values for selected labels
                _this.setState({ labels: labels }, function () {
                    _this.state.labels.forEach(function (label) {
                        if (label.selected) {
                            _this.fetchValues(label.name, EMPTY_SELECTOR);
                        }
                    });
                });
            });
        }
    };
    UnthemedPrometheusMetricsBrowser.prototype.doFacettingForLabel = function (name) {
        var label = this.state.labels.find(function (l) { return l.name === name; });
        if (!label) {
            return;
        }
        var selectedLabels = this.state.labels.filter(function (label) { return label.selected; }).map(function (label) { return label.name; });
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
    };
    UnthemedPrometheusMetricsBrowser.prototype.fetchValues = function (name, selector) {
        return __awaiter(this, void 0, void 0, function () {
            var languageProvider, rawValues, values, metricsMetadata, rawValues_1, rawValues_1_1, labelValue, value, meta, error_1;
            var e_2, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        languageProvider = this.props.languageProvider;
                        this.updateLabelState(name, { loading: true }, "Fetching values for " + name);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, languageProvider.getLabelValues(name)];
                    case 2:
                        rawValues = _b.sent();
                        // If selector changed, clear loading state and discard result by returning early
                        if (selector !== buildSelector(this.state.labels)) {
                            this.updateLabelState(name, { loading: false });
                            return [2 /*return*/];
                        }
                        values = [];
                        metricsMetadata = languageProvider.metricsMetadata;
                        try {
                            for (rawValues_1 = __values(rawValues), rawValues_1_1 = rawValues_1.next(); !rawValues_1_1.done; rawValues_1_1 = rawValues_1.next()) {
                                labelValue = rawValues_1_1.value;
                                value = { name: labelValue };
                                // Adding type/help text to metrics
                                if (name === METRIC_LABEL && metricsMetadata) {
                                    meta = metricsMetadata[labelValue];
                                    if (meta) {
                                        value.details = "(" + meta.type + ") " + meta.help;
                                    }
                                }
                                values.push(value);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (rawValues_1_1 && !rawValues_1_1.done && (_a = rawValues_1.return)) _a.call(rawValues_1);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                        this.updateLabelState(name, { values: values, loading: false });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        console.error(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    UnthemedPrometheusMetricsBrowser.prototype.fetchSeries = function (selector, lastFacetted) {
        return __awaiter(this, void 0, void 0, function () {
            var languageProvider, possibleLabels, labels, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        languageProvider = this.props.languageProvider;
                        if (lastFacetted) {
                            this.updateLabelState(lastFacetted, { loading: true }, "Facetting labels for " + selector);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, languageProvider.fetchSeriesLabels(selector, true)];
                    case 2:
                        possibleLabels = _a.sent();
                        // If selector changed, clear loading state and discard result by returning early
                        if (selector !== buildSelector(this.state.labels)) {
                            if (lastFacetted) {
                                this.updateLabelState(lastFacetted, { loading: false });
                            }
                            return [2 /*return*/];
                        }
                        if (Object.keys(possibleLabels).length === 0) {
                            this.setState({ error: "Empty results, no matching label for " + selector });
                            return [2 /*return*/];
                        }
                        labels = facetLabels(this.state.labels, possibleLabels, lastFacetted);
                        this.setState({ labels: labels, error: '' });
                        if (lastFacetted) {
                            this.updateLabelState(lastFacetted, { loading: false });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error(error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    UnthemedPrometheusMetricsBrowser.prototype.validateSelector = function (selector) {
        return __awaiter(this, void 0, void 0, function () {
            var languageProvider, streams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        languageProvider = this.props.languageProvider;
                        this.setState({ validationStatus: "Validating selector " + selector, error: '' });
                        return [4 /*yield*/, languageProvider.fetchSeries(selector)];
                    case 1:
                        streams = _a.sent();
                        this.setState({ validationStatus: "Selector is valid (" + streams.length + " series found)" });
                        return [2 /*return*/];
                }
            });
        });
    };
    UnthemedPrometheusMetricsBrowser.prototype.render = function () {
        var _this = this;
        var _a, _b;
        var theme = this.props.theme;
        var _c = this.state, labels = _c.labels, labelSearchTerm = _c.labelSearchTerm, metricSearchTerm = _c.metricSearchTerm, status = _c.status, error = _c.error, validationStatus = _c.validationStatus, valueSearchTerm = _c.valueSearchTerm;
        var styles = getStyles(theme);
        if (labels.length === 0) {
            return (React.createElement("div", { className: styles.wrapper },
                React.createElement(LoadingPlaceholder, { text: "Loading labels..." })));
        }
        // Filter metrics
        var metrics = labels.find(function (label) { return label.name === METRIC_LABEL; });
        if (metrics && metricSearchTerm) {
            metrics = __assign(__assign({}, metrics), { values: (_a = metrics.values) === null || _a === void 0 ? void 0 : _a.filter(function (value) { return value.selected || value.name.includes(metricSearchTerm); }) });
        }
        // Filter labels
        var nonMetricLabels = labels.filter(function (label) { return !label.hidden && label.name !== METRIC_LABEL; });
        if (labelSearchTerm) {
            nonMetricLabels = nonMetricLabels.filter(function (label) { return label.selected || label.name.includes(labelSearchTerm); });
        }
        // Filter non-metric label values
        var selectedLabels = nonMetricLabels.filter(function (label) { return label.selected && label.values; });
        if (valueSearchTerm) {
            selectedLabels = selectedLabels.map(function (label) {
                var _a;
                return (__assign(__assign({}, label), { values: (_a = label.values) === null || _a === void 0 ? void 0 : _a.filter(function (value) { return value.selected || value.name.includes(valueSearchTerm); }) }));
            });
        }
        var selector = buildSelector(this.state.labels);
        var empty = selector === EMPTY_SELECTOR;
        var metricCount = ((_b = metrics === null || metrics === void 0 ? void 0 : metrics.values) === null || _b === void 0 ? void 0 : _b.length) || 0;
        return (React.createElement("div", { className: styles.wrapper },
            React.createElement(HorizontalGroup, { align: "flex-start", spacing: "lg" },
                React.createElement("div", null,
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Once a metric is selected only possible labels are shown." }, "1. Select a metric"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeMetricSearch, "aria-label": "Filter expression for metric", value: metricSearchTerm })),
                        React.createElement("div", { role: "list", className: styles.valueListWrapper },
                            React.createElement(FixedSizeList, { height: Math.min(450, metricCount * LIST_ITEM_SIZE), itemCount: metricCount, itemSize: LIST_ITEM_SIZE, itemKey: function (i) { return metrics.values[i].name; }, width: 300, className: styles.valueList }, function (_a) {
                                var _b;
                                var index = _a.index, style = _a.style;
                                var value = (_b = metrics === null || metrics === void 0 ? void 0 : metrics.values) === null || _b === void 0 ? void 0 : _b[index];
                                if (!value) {
                                    return null;
                                }
                                return (React.createElement("div", { style: style },
                                    React.createElement(PromLabel, { name: metrics.name, value: value === null || value === void 0 ? void 0 : value.name, title: value.details, active: value === null || value === void 0 ? void 0 : value.selected, onClick: _this.onClickMetric, searchTerm: metricSearchTerm })));
                            })))),
                React.createElement("div", null,
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Once label values are selected, only possible label combinations are shown." }, "2. Select labels to search in"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeLabelSearch, "aria-label": "Filter expression for label", value: labelSearchTerm })),
                        React.createElement("div", { className: styles.list, style: { height: 120 } }, nonMetricLabels.map(function (label) { return (React.createElement(PromLabel, { key: label.name, name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, facets: label.facets, onClick: _this.onClickLabel, searchTerm: labelSearchTerm })); }))),
                    React.createElement("div", { className: styles.section },
                        React.createElement(Label, { description: "Use the search field to find values across selected labels." }, "3. Select (multiple) values for your labels"),
                        React.createElement("div", null,
                            React.createElement(Input, { onChange: this.onChangeValueSearch, "aria-label": "Filter expression for label values", value: valueSearchTerm })),
                        React.createElement("div", { className: styles.valueListArea, ref: this.valueListsRef }, selectedLabels.map(function (label) {
                            var _a, _b, _c;
                            return (React.createElement("div", { role: "list", key: label.name, "aria-label": "Values for " + label.name, className: styles.valueListWrapper },
                                React.createElement("div", { className: styles.valueTitle },
                                    React.createElement(PromLabel, { name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, 
                                        //If no facets, we want to show number of all label values
                                        facets: label.facets || ((_a = label.values) === null || _a === void 0 ? void 0 : _a.length), onClick: _this.onClickLabel })),
                                React.createElement(FixedSizeList, { height: Math.min(200, LIST_ITEM_SIZE * (((_b = label.values) === null || _b === void 0 ? void 0 : _b.length) || 0)), itemCount: ((_c = label.values) === null || _c === void 0 ? void 0 : _c.length) || 0, itemSize: 28, itemKey: function (i) { return label.values[i].name; }, width: 200, className: styles.valueList }, function (_a) {
                                    var _b;
                                    var index = _a.index, style = _a.style;
                                    var value = (_b = label.values) === null || _b === void 0 ? void 0 : _b[index];
                                    if (!value) {
                                        return null;
                                    }
                                    return (React.createElement("div", { style: style },
                                        React.createElement(PromLabel, { name: label.name, value: value === null || value === void 0 ? void 0 : value.name, active: value === null || value === void 0 ? void 0 : value.selected, onClick: _this.onClickValue, searchTerm: valueSearchTerm })));
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
    };
    return UnthemedPrometheusMetricsBrowser;
}(React.Component));
export { UnthemedPrometheusMetricsBrowser };
export var PrometheusMetricsBrowser = withTheme(UnthemedPrometheusMetricsBrowser);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
//# sourceMappingURL=PrometheusMetricsBrowser.js.map