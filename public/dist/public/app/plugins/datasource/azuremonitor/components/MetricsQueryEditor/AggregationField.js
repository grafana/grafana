import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';
import { setAggregation } from './setQueryValue';
const AggregationField = ({ query, variableOptionGroup, onQueryChange, aggregationOptions, isLoading, }) => {
    var _a, _b;
    const handleChange = useCallback((change) => {
        if (!change.value) {
            return;
        }
        const newQuery = setAggregation(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    const options = addValueToOptions(aggregationOptions, variableOptionGroup, (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.aggregation);
    return (React.createElement(Field, { label: "Aggregation" },
        React.createElement(Select, { inputId: "azure-monitor-metrics-aggregation-field", value: ((_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.aggregation) || null, onChange: handleChange, options: options, isLoading: isLoading })));
};
export default AggregationField;
//# sourceMappingURL=AggregationField.js.map