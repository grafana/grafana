import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __values } from "tslib";
import React from 'react';
import { Button, HorizontalGroup, Input, Label, LoadingPlaceholder, withTheme2, BrowserLabel as LokiLabel, fuzzyMatch, } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { FixedSizeList } from 'react-window';
import { sortBy } from 'lodash';
// Hard limit on labels to render
var MAX_LABEL_COUNT = 1000;
var MAX_VALUE_COUNT = 10000;
var MAX_AUTO_SELECT = 4;
var EMPTY_SELECTOR = '{}';
export function buildSelector(labels) {
    var e_1, _a;
    var selectedLabels = [];
    try {
        for (var labels_1 = __values(labels), labels_1_1 = labels_1.next(); !labels_1_1.done; labels_1_1 = labels_1.next()) {
            var label = labels_1_1.value;
            if (label.selected && label.values && label.values.length > 0) {
                var selectedValues = label.values.filter(function (value) { return value.selected; }).map(function (value) { return value.name; });
                if (selectedValues.length > 1) {
                    selectedLabels.push(label.name + "=~\"" + selectedValues.join('|') + "\"");
                }
                else if (selectedValues.length === 1) {
                    selectedLabels.push(label.name + "=\"" + selectedValues[0] + "\"");
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
    return ['{', selectedLabels.join(','), '}'].join('');
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
            return __assign(__assign({}, label), { loading: false, values: existingValues, facets: existingValues.length });
        }
        // Label is facetted out, hide all values
        return __assign(__assign({}, label), { loading: false, hidden: !possibleValues, values: undefined, facets: 0 });
    });
}
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: ", ";\n    padding: ", ";\n    width: 100%;\n  "], ["\n    background-color: ", ";\n    padding: ", ";\n    width: 100%;\n  "])), theme.colors.background.secondary, theme.spacing(2)),
    list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-top: ", ";\n    display: flex;\n    flex-wrap: wrap;\n    max-height: 200px;\n    overflow: auto;\n  "], ["\n    margin-top: ", ";\n    display: flex;\n    flex-wrap: wrap;\n    max-height: 200px;\n    overflow: auto;\n  "])), theme.spacing(1)),
    section: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    & + & {\n      margin: ", ";\n    }\n    position: relative;\n  "], ["\n    & + & {\n      margin: ", ";\n    }\n    position: relative;\n  "])), theme.spacing(2, 0)),
    selector: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    font-family: ", ";\n    margin-bottom: ", ";\n  "], ["\n    font-family: ", ";\n    margin-bottom: ", ";\n  "])), theme.typography.fontFamilyMonospace, theme.spacing(1)),
    status: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    padding: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    /* using absolute positioning because flex interferes with ellipsis */\n    position: absolute;\n    width: 50%;\n    right: 0;\n    text-align: right;\n    transition: opacity 100ms linear;\n    opacity: 0;\n  "], ["\n    padding: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    /* using absolute positioning because flex interferes with ellipsis */\n    position: absolute;\n    width: 50%;\n    right: 0;\n    text-align: right;\n    transition: opacity 100ms linear;\n    opacity: 0;\n  "])), theme.spacing(0.5), theme.colors.text.secondary),
    statusShowing: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    opacity: 1;\n  "], ["\n    opacity: 1;\n  "]))),
    error: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.error.main),
    valueList: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(1)),
    valueListWrapper: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    border-left: 1px solid ", ";\n    margin: ", ";\n    padding: ", ";\n  "], ["\n    border-left: 1px solid ", ";\n    margin: ", ";\n    padding: ", ";\n  "])), theme.colors.border.medium, theme.spacing(1, 0), theme.spacing(1, 0, 1, 1)),
    valueListArea: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    display: flex;\n    flex-wrap: wrap;\n    margin-top: ", ";\n  "], ["\n    display: flex;\n    flex-wrap: wrap;\n    margin-top: ", ";\n  "])), theme.spacing(1)),
    valueTitle: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    margin-left: -", ";\n    margin-bottom: ", ";\n  "], ["\n    margin-left: -", ";\n    margin-bottom: ", ";\n  "])), theme.spacing(0.5), theme.spacing(1)),
    validationStatus: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n    padding: ", ";\n    margin-bottom: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "], ["\n    padding: ", ";\n    margin-bottom: ", ";\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "])), theme.spacing(0.5), theme.spacing(1), theme.colors.text.maxContrast),
}); };
var UnthemedLokiLabelBrowser = /** @class */ (function (_super) {
    __extends(UnthemedLokiLabelBrowser, _super);
    function UnthemedLokiLabelBrowser() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            labels: [],
            searchTerm: '',
            status: 'Ready',
            error: '',
            validationStatus: '',
        };
        _this.onChangeSearch = function (event) {
            _this.setState({ searchTerm: event.target.value });
        };
        _this.onClickRunLogsQuery = function () {
            var selector = buildSelector(_this.state.labels);
            _this.props.onChange(selector);
        };
        _this.onClickRunMetricsQuery = function () {
            var selector = buildSelector(_this.state.labels);
            var query = "rate(" + selector + "[$__interval])";
            _this.props.onChange(query);
        };
        _this.onClickClear = function () {
            _this.setState(function (state) {
                var labels = state.labels.map(function (label) { return (__assign(__assign({}, label), { values: undefined, selected: false, loading: false, hidden: false, facets: undefined })); });
                return { labels: labels, searchTerm: '', status: '', error: '', validationStatus: '' };
            });
            _this.props.deleteLastUsedLabels();
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
            _this.setState({ searchTerm: '' });
            _this.updateLabelState(name, nextValue, '', function () { return _this.doFacettingForLabel(name); });
        };
        _this.onClickValue = function (name, value, event) {
            var label = _this.state.labels.find(function (l) { return l.name === name; });
            if (!label || !label.values) {
                return;
            }
            // Resetting search to prevent empty results
            _this.setState({ searchTerm: '' });
            // Toggling value for selected label, leaving other values intact
            var values = label.values.map(function (v) { return (__assign(__assign({}, v), { selected: v.name === value ? !v.selected : v.selected })); });
            _this.updateLabelState(name, { values: values }, '', function () { return _this.doFacetting(name); });
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
                    _this.state.labels.forEach(function (label) { return label.selected && _this.fetchValues(label.name, selector); });
                });
            }
            else {
                // Do facetting
                _this.fetchSeries(selector, lastFacetted);
            }
        };
        return _this;
    }
    UnthemedLokiLabelBrowser.prototype.updateLabelState = function (name, updatedFields, status, cb) {
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
    UnthemedLokiLabelBrowser.prototype.componentDidMount = function () {
        var _this = this;
        var _a = this.props, languageProvider = _a.languageProvider, _b = _a.autoSelect, autoSelect = _b === void 0 ? MAX_AUTO_SELECT : _b, lastUsedLabels = _a.lastUsedLabels;
        if (languageProvider) {
            var selectedLabels_1 = lastUsedLabels;
            languageProvider.start().then(function () {
                var rawLabels = languageProvider.getLabelKeys();
                if (rawLabels.length > MAX_LABEL_COUNT) {
                    var error = "Too many labels found (showing only " + MAX_LABEL_COUNT + " of " + rawLabels.length + ")";
                    rawLabels = rawLabels.slice(0, MAX_LABEL_COUNT);
                    _this.setState({ error: error });
                }
                // Auto-select all labels if label list is small enough
                var labels = rawLabels.map(function (label, i, arr) { return ({
                    name: label,
                    selected: (arr.length <= autoSelect && selectedLabels_1.length === 0) || selectedLabels_1.includes(label),
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
    UnthemedLokiLabelBrowser.prototype.doFacettingForLabel = function (name) {
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
    UnthemedLokiLabelBrowser.prototype.fetchValues = function (name, selector) {
        return __awaiter(this, void 0, void 0, function () {
            var languageProvider, rawValues, error, values, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        languageProvider = this.props.languageProvider;
                        this.updateLabelState(name, { loading: true }, "Fetching values for " + name);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, languageProvider.getLabelValues(name)];
                    case 2:
                        rawValues = _a.sent();
                        // If selector changed, clear loading state and discard result by returning early
                        if (selector !== buildSelector(this.state.labels)) {
                            this.updateLabelState(name, { loading: false }, '');
                            return [2 /*return*/];
                        }
                        if (rawValues.length > MAX_VALUE_COUNT) {
                            error = "Too many values for " + name + " (showing only " + MAX_VALUE_COUNT + " of " + rawValues.length + ")";
                            rawValues = rawValues.slice(0, MAX_VALUE_COUNT);
                            this.setState({ error: error });
                        }
                        values = rawValues.map(function (value) { return ({ name: value }); });
                        this.updateLabelState(name, { values: values, loading: false });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    UnthemedLokiLabelBrowser.prototype.fetchSeries = function (selector, lastFacetted) {
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
    UnthemedLokiLabelBrowser.prototype.validateSelector = function (selector) {
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
                        this.setState({ validationStatus: "Selector is valid (" + streams.length + " streams found)" });
                        return [2 /*return*/];
                }
            });
        });
    };
    UnthemedLokiLabelBrowser.prototype.render = function () {
        var _this = this;
        var theme = this.props.theme;
        var _a = this.state, labels = _a.labels, searchTerm = _a.searchTerm, status = _a.status, error = _a.error, validationStatus = _a.validationStatus;
        if (labels.length === 0) {
            return React.createElement(LoadingPlaceholder, { text: "Loading labels..." });
        }
        var styles = getStyles(theme);
        var selector = buildSelector(this.state.labels);
        var empty = selector === EMPTY_SELECTOR;
        var selectedLabels = labels.filter(function (label) { return label.selected && label.values; });
        if (searchTerm) {
            selectedLabels = selectedLabels.map(function (label) {
                var searchResults = label.values.filter(function (value) {
                    // Always return selected values
                    if (value.selected) {
                        value.highlightParts = undefined;
                        return true;
                    }
                    var fuzzyMatchResult = fuzzyMatch(value.name.toLowerCase(), searchTerm.toLowerCase());
                    if (fuzzyMatchResult.found) {
                        value.highlightParts = fuzzyMatchResult.ranges;
                        value.order = fuzzyMatchResult.distance;
                        return true;
                    }
                    else {
                        return false;
                    }
                });
                return __assign(__assign({}, label), { values: sortBy(searchResults, function (value) { return (value.selected ? -Infinity : value.order); }) });
            });
        }
        else {
            // Clear highlight parts when searchTerm is cleared
            selectedLabels = this.state.labels
                .filter(function (label) { return label.selected && label.values; })
                .map(function (label) { return (__assign(__assign({}, label), { values: (label === null || label === void 0 ? void 0 : label.values) ? label.values.map(function (value) { return (__assign(__assign({}, value), { highlightParts: undefined })); }) : [] })); });
        }
        return (React.createElement("div", { className: styles.wrapper },
            React.createElement("div", { className: styles.section },
                React.createElement(Label, { description: "Which labels would you like to consider for your search?" }, "1. Select labels to search in"),
                React.createElement("div", { className: styles.list }, labels.map(function (label) { return (React.createElement(LokiLabel, { key: label.name, name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, facets: label.facets, onClick: _this.onClickLabel })); }))),
            React.createElement("div", { className: styles.section },
                React.createElement(Label, { description: "Choose the label values that you would like to use for the query. Use the search field to find values across selected labels." }, "2. Find values for the selected labels"),
                React.createElement("div", null,
                    React.createElement(Input, { onChange: this.onChangeSearch, "aria-label": "Filter expression for values", value: searchTerm })),
                React.createElement("div", { className: styles.valueListArea }, selectedLabels.map(function (label) {
                    var _a, _b;
                    return (React.createElement("div", { role: "list", key: label.name, className: styles.valueListWrapper },
                        React.createElement("div", { className: styles.valueTitle, "aria-label": "Values for " + label.name },
                            React.createElement(LokiLabel, { name: label.name, loading: label.loading, active: label.selected, hidden: label.hidden, 
                                //If no facets, we want to show number of all label values
                                facets: label.facets || ((_a = label.values) === null || _a === void 0 ? void 0 : _a.length), onClick: _this.onClickLabel })),
                        React.createElement(FixedSizeList, { height: 200, itemCount: ((_b = label.values) === null || _b === void 0 ? void 0 : _b.length) || 0, itemSize: 28, itemKey: function (i) { return label.values[i].name; }, width: 200, className: styles.valueList }, function (_a) {
                            var _b;
                            var index = _a.index, style = _a.style;
                            var value = (_b = label.values) === null || _b === void 0 ? void 0 : _b[index];
                            if (!value) {
                                return null;
                            }
                            return (React.createElement("div", { style: style },
                                React.createElement(LokiLabel, { name: label.name, value: value === null || value === void 0 ? void 0 : value.name, active: value === null || value === void 0 ? void 0 : value.selected, highlightParts: value === null || value === void 0 ? void 0 : value.highlightParts, onClick: _this.onClickValue, searchTerm: searchTerm })));
                        })));
                }))),
            React.createElement("div", { className: styles.section },
                React.createElement(Label, null, "3. Resulting selector"),
                React.createElement("div", { "aria-label": "selector", className: styles.selector }, selector),
                validationStatus && React.createElement("div", { className: styles.validationStatus }, validationStatus),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { "aria-label": "Use selector as logs button", disabled: empty, onClick: this.onClickRunLogsQuery }, "Show logs"),
                    React.createElement(Button, { "aria-label": "Use selector as metrics button", variant: "secondary", disabled: empty, onClick: this.onClickRunMetricsQuery }, "Show logs rate"),
                    React.createElement(Button, { "aria-label": "Validate submit button", variant: "secondary", disabled: empty, onClick: this.onClickValidate }, "Validate selector"),
                    React.createElement(Button, { "aria-label": "Selector clear button", variant: "secondary", onClick: this.onClickClear }, "Clear"),
                    React.createElement("div", { className: cx(styles.status, (status || error) && styles.statusShowing) },
                        React.createElement("span", { className: error ? styles.error : '' }, error || status))))));
    };
    return UnthemedLokiLabelBrowser;
}(React.Component));
export { UnthemedLokiLabelBrowser };
export var LokiLabelBrowser = withTheme2(UnthemedLokiLabelBrowser);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
//# sourceMappingURL=LokiLabelBrowser.js.map