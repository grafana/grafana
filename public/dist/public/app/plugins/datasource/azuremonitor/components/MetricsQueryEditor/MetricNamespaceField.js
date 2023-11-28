import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';
import { setCustomNamespace } from './setQueryValue';
const MetricNamespaceField = ({ metricNamespaces, query, variableOptionGroup, onQueryChange, }) => {
    var _a, _b;
    const handleChange = useCallback((change) => {
        if (!change.value) {
            return;
        }
        const newQuery = setCustomNamespace(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    const value = ((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.customNamespace) || ((_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricNamespace);
    const options = addValueToOptions(metricNamespaces, variableOptionGroup, value);
    return (React.createElement(Field, { label: "Metric namespace" },
        React.createElement(Select, { inputId: "azure-monitor-metrics-metric-namespace-field", value: value || null, onChange: handleChange, options: options, allowCustomValue: true })));
};
export default MetricNamespaceField;
//# sourceMappingURL=MetricNamespaceField.js.map