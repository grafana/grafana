import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import TimegrainConverter from '../../time_grain_converter';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../Field';
import { setTimeGrain } from './setQueryValue';
const TimeGrainField = ({ query, timeGrainOptions, variableOptionGroup, onQueryChange }) => {
    var _a, _b;
    const handleChange = useCallback((change) => {
        if (!change.value) {
            return;
        }
        const newQuery = setTimeGrain(query, change.value);
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    const timeGrains = useMemo(() => {
        var _a;
        const autoInterval = TimegrainConverter.findClosestTimeGrain('1m', timeGrainOptions.map((o) => TimegrainConverter.createKbnUnitFromISO8601Duration(o.value)) || [
            '1m',
            '5m',
            '15m',
            '30m',
            '1h',
            '6h',
            '12h',
            '1d',
        ]);
        const baseTimeGrains = timeGrainOptions.map((v) => (v.value === 'auto' ? Object.assign(Object.assign({}, v), { description: autoInterval }) : v));
        const options = addValueToOptions(baseTimeGrains, variableOptionGroup, (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrain);
        return options;
    }, [timeGrainOptions, variableOptionGroup, (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrain]);
    return (React.createElement(Field, { label: "Time grain" },
        React.createElement(Select, { inputId: "azure-monitor-metrics-time-grain-field", value: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.timeGrain, onChange: handleChange, options: timeGrains })));
};
export default TimeGrainField;
//# sourceMappingURL=TimeGrainField.js.map