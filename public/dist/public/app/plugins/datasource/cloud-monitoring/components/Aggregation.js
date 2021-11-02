import { __assign, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorField } from '.';
import { getAggregationOptionsByMetric } from '../functions';
export var Aggregation = function (props) {
    var aggOptions = useAggregationOptionsByMetric(props);
    var selected = useSelectedFromOptions(aggOptions, props);
    return (React.createElement(QueryEditorField, { labelWidth: 18, label: "Group by function", "data-testid": "cloud-monitoring-aggregation" },
        React.createElement(Select, { menuShouldPortal: true, width: 16, onChange: function (_a) {
                var value = _a.value;
                return props.onChange(value);
            }, value: selected, options: [
                {
                    label: 'Template Variables',
                    options: props.templateVariableOptions,
                },
                {
                    label: 'Aggregations',
                    expanded: true,
                    options: aggOptions,
                },
            ], placeholder: "Select Reducer" })));
};
var useAggregationOptionsByMetric = function (_a) {
    var metricDescriptor = _a.metricDescriptor;
    var valueType = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.valueType;
    var metricKind = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.metricKind;
    return useMemo(function () {
        if (!valueType || !metricKind) {
            return [];
        }
        return getAggregationOptionsByMetric(valueType, metricKind).map(function (a) { return (__assign(__assign({}, a), { label: a.text })); });
    }, [valueType, metricKind]);
};
var useSelectedFromOptions = function (aggOptions, props) {
    return useMemo(function () {
        var allOptions = __spreadArray(__spreadArray([], __read(aggOptions), false), __read(props.templateVariableOptions), false);
        return allOptions.find(function (s) { return s.value === props.crossSeriesReducer; });
    }, [aggOptions, props.crossSeriesReducer, props.templateVariableOptions]);
};
//# sourceMappingURL=Aggregation.js.map