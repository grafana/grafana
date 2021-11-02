import { __assign, __extends } from "tslib";
import { map } from 'lodash';
import React, { PureComponent } from 'react';
// Types
import { InlineFormLabel, LegacyForms, Select } from '@grafana/ui';
import PromQueryField from './PromQueryField';
import PromLink from './PromLink';
import { PromExemplarField } from './PromExemplarField';
var Switch = LegacyForms.Switch;
var FORMAT_OPTIONS = [
    { label: 'Time series', value: 'time_series' },
    { label: 'Table', value: 'table' },
    { label: 'Heatmap', value: 'heatmap' },
];
var INTERVAL_FACTOR_OPTIONS = map([1, 2, 3, 4, 5, 10], function (value) { return ({
    value: value,
    label: '1/' + value,
}); });
var PromQueryEditor = /** @class */ (function (_super) {
    __extends(PromQueryEditor, _super);
    function PromQueryEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onFieldChange = function (query, override) {
            _this.query.expr = query.expr;
        };
        _this.onFormatChange = function (option) {
            _this.query.format = option.value;
            _this.setState({ formatOption: option }, _this.onRunQuery);
        };
        _this.onInstantChange = function (e) {
            var instant = e.target.checked;
            _this.query.instant = instant;
            _this.setState({ instant: instant }, _this.onRunQuery);
        };
        _this.onIntervalChange = function (e) {
            var interval = e.currentTarget.value;
            _this.query.interval = interval;
            _this.setState({ interval: interval });
        };
        _this.onIntervalFactorChange = function (option) {
            _this.query.intervalFactor = option.value;
            _this.setState({ intervalFactorOption: option }, _this.onRunQuery);
        };
        _this.onLegendChange = function (e) {
            var legendFormat = e.currentTarget.value;
            _this.query.legendFormat = legendFormat;
            _this.setState({ legendFormat: legendFormat });
        };
        _this.onExemplarChange = function (isEnabled) {
            _this.query.exemplar = isEnabled;
            _this.setState({ exemplar: isEnabled }, _this.onRunQuery);
        };
        _this.onRunQuery = function () {
            var query = _this.query;
            // Change of query.hide happens outside of this component and is just passed as prop. We have to update it when running queries.
            var hide = _this.props.query.hide;
            _this.props.onChange(__assign(__assign({}, query), { hide: hide }));
            _this.props.onRunQuery();
        };
        // Use default query to prevent undefined input values
        var defaultQuery = {
            expr: '',
            legendFormat: '',
            interval: '',
            exemplar: true,
        };
        var query = Object.assign({}, defaultQuery, props.query);
        _this.query = query;
        // Query target properties that are fully controlled inputs
        _this.state = {
            // Fully controlled text inputs
            interval: query.interval,
            legendFormat: query.legendFormat,
            // Select options
            formatOption: FORMAT_OPTIONS.find(function (option) { return option.value === query.format; }) || FORMAT_OPTIONS[0],
            intervalFactorOption: INTERVAL_FACTOR_OPTIONS.find(function (option) { return option.value === query.intervalFactor; }) || INTERVAL_FACTOR_OPTIONS[0],
            // Switch options
            instant: Boolean(query.instant),
            exemplar: Boolean(query.exemplar),
        };
        return _this;
    }
    PromQueryEditor.prototype.render = function () {
        var _a = this.props, datasource = _a.datasource, query = _a.query, range = _a.range, data = _a.data;
        var _b = this.state, formatOption = _b.formatOption, instant = _b.instant, interval = _b.interval, intervalFactorOption = _b.intervalFactorOption, legendFormat = _b.legendFormat;
        return (React.createElement(PromQueryField, { datasource: datasource, query: query, range: range, onRunQuery: this.onRunQuery, onChange: this.onFieldChange, history: [], data: data, "data-testid": testIds.editor, ExtraFieldElement: React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 7, tooltip: "Controls the name of the time series, using name or pattern. For example\n        {{hostname}} will be replaced with label value for the label hostname." }, "Legend"),
                    React.createElement("input", { type: "text", className: "gf-form-input", placeholder: "legend format", value: legendFormat, onChange: this.onLegendChange, onBlur: this.onRunQuery })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 7, tooltip: React.createElement(React.Fragment, null,
                            "An additional lower limit for the step parameter of the Prometheus query and for the",
                            ' ',
                            React.createElement("code", null, "$__interval"),
                            " and ",
                            React.createElement("code", null, "$__rate_interval"),
                            " variables. The limit is absolute and not modified by the \"Resolution\" setting.") }, "Min step"),
                    React.createElement("input", { type: "text", className: "gf-form-input width-8", placeholder: interval, onChange: this.onIntervalChange, onBlur: this.onRunQuery, value: interval })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label" }, "Resolution"),
                    React.createElement(Select, { menuShouldPortal: true, isSearchable: false, options: INTERVAL_FACTOR_OPTIONS, onChange: this.onIntervalFactorChange, value: intervalFactorOption })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-7" }, "Format"),
                    React.createElement(Select, { menuShouldPortal: true, className: "select-container", width: 16, isSearchable: false, options: FORMAT_OPTIONS, onChange: this.onFormatChange, value: formatOption }),
                    React.createElement(Switch, { label: "Instant", checked: instant, onChange: this.onInstantChange }),
                    React.createElement(InlineFormLabel, { width: 10, tooltip: "Link to Graph in Prometheus" },
                        React.createElement(PromLink, { datasource: datasource, query: this.query, panelData: data }))),
                React.createElement(PromExemplarField, { onChange: this.onExemplarChange, datasource: datasource, query: this.query })) }));
    };
    return PromQueryEditor;
}(PureComponent));
export { PromQueryEditor };
export var testIds = {
    editor: 'prom-editor',
};
//# sourceMappingURL=PromQueryEditor.js.map