import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { Field } from '../Field';
import { setLegendAlias } from './setQueryValue';
const LegendFormatField = ({ onQueryChange, query }) => {
    var _a, _b;
    const [value, setValue] = useState((_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.alias) !== null && _b !== void 0 ? _b : '');
    // As calling onQueryChange initiates a the datasource refresh, we only want to call it once
    // the field loses focus
    const handleChange = useCallback((ev) => {
        if (ev.target instanceof HTMLInputElement) {
            setValue(ev.target.value);
        }
    }, []);
    const handleBlur = useCallback(() => {
        const newQuery = setLegendAlias(query, value);
        onQueryChange(newQuery);
    }, [onQueryChange, query, value]);
    return (React.createElement(Field, { label: "Legend format" },
        React.createElement(Input, { id: "azure-monitor-metrics-legend-field", placeholder: "Alias patterns", value: value, onChange: handleChange, onBlur: handleBlur, width: 38 })));
};
export default LegendFormatField;
//# sourceMappingURL=LegendFormatField.js.map