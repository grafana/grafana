var _a;
import { __assign, __extends, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { LegacyForms, EventsWithValidation, Icon } from '@grafana/ui';
var Input = LegacyForms.Input, Switch = LegacyForms.Switch;
import { QueryField, Alias, MetricsQueryFieldsEditor } from './';
var idValidationEvents = (_a = {},
    _a[EventsWithValidation.onBlur] = [
        {
            rule: function (value) { return new RegExp(/^$|^[a-z][a-zA-Z0-9_]*$/).test(value); },
            errorMessage: 'Invalid format. Only alphanumeric characters and underscores are allowed',
        },
    ],
    _a);
export var normalizeQuery = function (_a) {
    var namespace = _a.namespace, metricName = _a.metricName, expression = _a.expression, dimensions = _a.dimensions, region = _a.region, id = _a.id, alias = _a.alias, statistic = _a.statistic, period = _a.period, rest = __rest(_a, ["namespace", "metricName", "expression", "dimensions", "region", "id", "alias", "statistic", "period"]);
    var normalizedQuery = __assign({ namespace: namespace || '', metricName: metricName || '', expression: expression || '', dimensions: dimensions || {}, region: region || 'default', id: id || '', alias: alias || '', statistic: statistic !== null && statistic !== void 0 ? statistic : 'Average', period: period || '' }, rest);
    return !rest.hasOwnProperty('matchExact') ? __assign(__assign({}, normalizedQuery), { matchExact: true }) : normalizedQuery;
};
var MetricsQueryEditor = /** @class */ (function (_super) {
    __extends(MetricsQueryEditor, _super);
    function MetricsQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { showMeta: false };
        return _this;
    }
    MetricsQueryEditor.prototype.componentDidMount = function () {
        var metricsQuery = this.props.query;
        var query = normalizeQuery(metricsQuery);
        this.props.onChange(query);
    };
    MetricsQueryEditor.prototype.onChange = function (query) {
        var _a = this.props, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
        onChange(query);
        onRunQuery();
    };
    MetricsQueryEditor.prototype.getExecutedQueryPreview = function (data) {
        var _a, _b;
        if (!((data === null || data === void 0 ? void 0 : data.series.length) && ((_a = data === null || data === void 0 ? void 0 : data.series[0].meta) === null || _a === void 0 ? void 0 : _a.custom))) {
            return {
                executedQuery: '',
                period: '',
                id: '',
            };
        }
        return {
            executedQuery: (_b = data === null || data === void 0 ? void 0 : data.series[0].meta.executedQueryString) !== null && _b !== void 0 ? _b : '',
            period: data.series[0].meta.custom['period'],
            id: data.series[0].meta.custom['id'],
        };
    };
    MetricsQueryEditor.prototype.render = function () {
        var _this = this;
        var _a = this.props, data = _a.data, onRunQuery = _a.onRunQuery;
        var metricsQuery = this.props.query;
        var showMeta = this.state.showMeta;
        var query = normalizeQuery(metricsQuery);
        var executedQueryPreview = this.getExecutedQueryPreview(data);
        return (React.createElement(React.Fragment, null,
            React.createElement(MetricsQueryFieldsEditor, __assign({}, __assign(__assign({}, this.props), { query: query }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(QueryField, { label: "Id", tooltip: "Id can include numbers, letters, and underscore, and must start with a lowercase letter." },
                        React.createElement(Input, { className: "gf-form-input width-8", onBlur: onRunQuery, onChange: function (event) {
                                return _this.onChange(__assign(__assign({}, metricsQuery), { id: event.target.value }));
                            }, validationEvents: idValidationEvents, value: query.id }))),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(QueryField, { className: "gf-form--grow", label: "Expression", tooltip: "Optionally you can add an expression here. Please note that if a math expression that is referencing other queries is being used, it will not be possible to create an alert rule based on this query" },
                        React.createElement(Input, { className: "gf-form-input", onBlur: onRunQuery, value: query.expression || '', onChange: function (event) {
                                return _this.onChange(__assign(__assign({}, metricsQuery), { expression: event.target.value }));
                            } })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(QueryField, { label: "Period", tooltip: "Minimum interval between points in seconds" },
                        React.createElement(Input, { className: "gf-form-input width-8", value: query.period || '', placeholder: "auto", onBlur: onRunQuery, onChange: function (event) {
                                return _this.onChange(__assign(__assign({}, metricsQuery), { period: event.target.value }));
                            } }))),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(QueryField, { label: "Alias", tooltip: "Alias replacement variables: {{metric}}, {{stat}}, {{namespace}}, {{region}}, {{period}}, {{label}}, {{YOUR_DIMENSION_NAME}}" },
                        React.createElement(Alias, { value: metricsQuery.alias, onChange: function (value) { return _this.onChange(__assign(__assign({}, metricsQuery), { alias: value })); } })),
                    React.createElement(Switch, { label: "Match Exact", labelClass: "query-keyword", tooltip: "Only show metrics that exactly match all defined dimension names.", checked: metricsQuery.matchExact, onChange: function () {
                            return _this.onChange(__assign(__assign({}, metricsQuery), { matchExact: !metricsQuery.matchExact }));
                        } }),
                    React.createElement("label", { className: "gf-form-label" },
                        React.createElement("a", { onClick: function () {
                                return executedQueryPreview &&
                                    _this.setState({
                                        showMeta: !showMeta,
                                    });
                            } },
                            React.createElement(Icon, { name: showMeta ? 'angle-down' : 'angle-right' }),
                            " ",
                            showMeta ? 'Hide' : 'Show',
                            " Query Preview"))),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" })),
                showMeta && (React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Metric Data Query ID"),
                            React.createElement("th", null, "Metric Data Query Expression"),
                            React.createElement("th", null, "Period"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, executedQueryPreview.id),
                            React.createElement("td", null, executedQueryPreview.executedQuery),
                            React.createElement("td", null, executedQueryPreview.period))))))));
    };
    return MetricsQueryEditor;
}(PureComponent));
export { MetricsQueryEditor };
//# sourceMappingURL=MetricsQueryEditor.js.map