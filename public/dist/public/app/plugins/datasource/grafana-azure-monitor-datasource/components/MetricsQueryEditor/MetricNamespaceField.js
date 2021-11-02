import { __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { setMetricNamespace } from './setQueryValue';
var MetricNamespaceField = function (_a) {
    var _b;
    var metricNamespaces = _a.metricNamespaces, query = _a.query, variableOptionGroup = _a.variableOptionGroup, onQueryChange = _a.onQueryChange;
    var handleChange = useCallback(function (change) {
        if (!change.value) {
            return;
        }
        var newQuery = setMetricNamespace(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    var options = useMemo(function () { return __spreadArray(__spreadArray([], __read(metricNamespaces), false), [variableOptionGroup], false); }, [metricNamespaces, variableOptionGroup]);
    return (React.createElement(Field, { label: "Metric namespace" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-metrics-metric-namespace-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricNamespace, onChange: handleChange, options: options, width: 38 })));
};
export default MetricNamespaceField;
//# sourceMappingURL=MetricNamespaceField.js.map