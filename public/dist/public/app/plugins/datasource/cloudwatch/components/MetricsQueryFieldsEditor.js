import { __assign, __awaiter, __generator, __read, __rest, __spreadArray } from "tslib";
import React, { useEffect, useState } from 'react';
import { Segment, SegmentAsync } from '@grafana/ui';
import { Dimensions, QueryInlineField } from '.';
export function MetricsQueryFieldsEditor(_a) {
    var _this = this;
    var _b;
    var query = _a.query, datasource = _a.datasource, onChange = _a.onChange, _c = _a.onRunQuery, onRunQuery = _c === void 0 ? function () { } : _c;
    var metricsQuery = query;
    var _d = __read(useState({
        regions: [],
        namespaces: [],
        metricNames: [],
        variableOptionGroup: {},
        showMeta: false,
    }), 2), state = _d[0], setState = _d[1];
    useEffect(function () {
        var variableOptionGroup = {
            label: 'Template Variables',
            options: datasource.getVariables().map(toOption),
        };
        Promise.all([datasource.metricFindQuery('regions()'), datasource.metricFindQuery('namespaces()')]).then(function (_a) {
            var _b = __read(_a, 2), regions = _b[0], namespaces = _b[1];
            setState(function (prevState) { return (__assign(__assign({}, prevState), { regions: __spreadArray(__spreadArray([], __read(regions), false), [variableOptionGroup], false), namespaces: __spreadArray(__spreadArray([], __read(namespaces), false), [variableOptionGroup], false), variableOptionGroup: variableOptionGroup })); });
        });
    }, [datasource]);
    var loadMetricNames = function () { return __awaiter(_this, void 0, void 0, function () {
        var namespace, region;
        return __generator(this, function (_a) {
            namespace = query.namespace, region = query.region;
            return [2 /*return*/, datasource.metricFindQuery("metrics(" + namespace + "," + region + ")").then(appendTemplateVariables)];
        });
    }); };
    var appendTemplateVariables = function (values) { return __spreadArray(__spreadArray([], __read(values), false), [
        { label: 'Template Variables', options: datasource.getVariables().map(toOption) },
    ], false); };
    var toOption = function (value) { return ({ label: value, value: value }); };
    var onQueryChange = function (query) {
        onChange(query);
        onRunQuery();
    };
    // Load dimension values based on current selected dimensions.
    // Remove the new dimension key and all dimensions that has a wildcard as selected value
    var loadDimensionValues = function (newKey) {
        var _a = metricsQuery.dimensions, _b = newKey, value = _a[_b], dim = __rest(_a, [typeof _b === "symbol" ? _b : _b + ""]);
        var newDimensions = Object.entries(dim).reduce(function (result, _a) {
            var _b;
            var _c = __read(_a, 2), key = _c[0], value = _c[1];
            return (value === '*' ? result : __assign(__assign({}, result), (_b = {}, _b[key] = value, _b)));
        }, {});
        return datasource
            .getDimensionValues(query.region, query.namespace, metricsQuery.metricName, newKey, newDimensions)
            .then(function (values) { return (values.length ? __spreadArray([{ value: '*', text: '*', label: '*' }], __read(values), false) : values); })
            .then(appendTemplateVariables);
    };
    var regions = state.regions, namespaces = state.namespaces, variableOptionGroup = state.variableOptionGroup;
    return (React.createElement(React.Fragment, null,
        React.createElement(QueryInlineField, { label: "Region" },
            React.createElement(Segment, { value: query.region, placeholder: "Select region", options: regions, allowCustomValue: true, onChange: function (_a) {
                    var region = _a.value;
                    return onQueryChange(__assign(__assign({}, query), { region: region }));
                } })),
        ((_b = query.expression) === null || _b === void 0 ? void 0 : _b.length) === 0 && (React.createElement(React.Fragment, null,
            React.createElement(QueryInlineField, { label: "Namespace" },
                React.createElement(Segment, { value: query.namespace, placeholder: "Select namespace", allowCustomValue: true, options: namespaces, onChange: function (_a) {
                        var namespace = _a.value;
                        return onQueryChange(__assign(__assign({}, query), { namespace: namespace }));
                    } })),
            React.createElement(QueryInlineField, { label: "Metric Name" },
                React.createElement(SegmentAsync, { value: metricsQuery.metricName, placeholder: "Select metric name", allowCustomValue: true, loadOptions: loadMetricNames, onChange: function (_a) {
                        var metricName = _a.value;
                        return onQueryChange(__assign(__assign({}, metricsQuery), { metricName: metricName }));
                    } })),
            React.createElement(QueryInlineField, { label: "Statistic" },
                React.createElement(Segment, { allowCustomValue: true, value: query.statistic, options: __spreadArray(__spreadArray([], __read(datasource.standardStatistics.filter(function (s) { return s !== query.statistic; }).map(toOption)), false), [
                        variableOptionGroup,
                    ], false), onChange: function (_a) {
                        var statistic = _a.value;
                        if (!datasource.standardStatistics.includes(statistic) &&
                            !/^p\d{2}(?:\.\d{1,2})?$/.test(statistic) &&
                            !statistic.startsWith('$')) {
                            return;
                        }
                        onQueryChange(__assign(__assign({}, metricsQuery), { statistic: statistic }));
                    } })),
            React.createElement(QueryInlineField, { label: "Dimensions" },
                React.createElement(Dimensions, { dimensions: metricsQuery.dimensions, onChange: function (dimensions) { return onQueryChange(__assign(__assign({}, metricsQuery), { dimensions: dimensions })); }, loadKeys: function () { return datasource.getDimensionKeys(query.namespace, query.region).then(appendTemplateVariables); }, loadValues: loadDimensionValues }))))));
}
//# sourceMappingURL=MetricsQueryFieldsEditor.js.map