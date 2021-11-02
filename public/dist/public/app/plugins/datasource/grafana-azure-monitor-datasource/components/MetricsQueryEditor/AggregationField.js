import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setAggregation } from './setQueryValue';
var AggregationField = function (_a) {
    var _b;
    var query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange, aggregationOptions = _a.aggregationOptions, isLoading = _a.isLoading;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = setAggregation(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(aggregationOptions), false), [variableOptionGroup], false); }, [
        aggregationOptions,
        variableOptionGroup,
    ]);
    return (React.createElement(Field, { label: "Aggregation" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-aggregation-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.aggregation, onChange: handleChange, options: options, width: 38, isLoading: isLoading })));
};
export default AggregationField;
//# sourceMappingURL=AggregationField.js.map