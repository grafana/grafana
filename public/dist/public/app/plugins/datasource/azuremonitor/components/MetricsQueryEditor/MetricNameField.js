import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';
import { setMetricName } from './setQueryValue';
const MetricNameField = ({ metricNames, query, variableOptionGroup, onQueryChange }) => {
    var _a, _b, _c;
    const handleChange = useCallback((change) => {
        if (!change.value) {
            return;
        }
        const newQuery = setMetricName(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    const options = addValueToOptions(metricNames, variableOptionGroup, (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricName);
    return (React.createElement(Field, { label: "Metric", "data-testid": selectors.components.queryEditor.metricsQueryEditor.metricName.input },
        React.createElement(Select, { inputId: "azure-monitor-metrics-metric-field", value: (_c = (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricName) !== null && _c !== void 0 ? _c : null, onChange: handleChange, options: options, allowCustomValue: true })));
};
export default MetricNameField;
//# sourceMappingURL=MetricNameField.js.map