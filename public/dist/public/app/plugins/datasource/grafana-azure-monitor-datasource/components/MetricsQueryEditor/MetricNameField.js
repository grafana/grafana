import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setMetricName } from './setQueryValue';
var MetricNameField = function (_a) {
    var _b, _c;
    var metricNames = _a.metricNames, query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = setMetricName(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(metricNames), false), [variableOptionGroup], false); }, [metricNames, variableOptionGroup]);
    return (React.createElement(Field, { label: "Metric" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-metric-field", value: (_c = (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricName) !== null && _c !== void 0 ? _c : null, onChange: handleChange, options: options, width: 38 })));
};
export default MetricNameField;
//# sourceMappingURL=MetricNameField.js.map