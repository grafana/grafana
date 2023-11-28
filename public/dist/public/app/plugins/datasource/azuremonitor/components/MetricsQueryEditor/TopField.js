import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { Field } from '../Field';
import { setTop } from './setQueryValue';
const TopField = ({ onQueryChange, query }) => {
    var _a, _b;
    const [value, setValue] = useState((_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.top) !== null && _b !== void 0 ? _b : '');
    // As calling onQueryChange initiates a the datasource refresh, we only want to call it once
    // the field loses focus
    const handleChange = useCallback((ev) => {
        if (ev.target instanceof HTMLInputElement) {
            setValue(ev.target.value);
        }
    }, []);
    const handleBlur = useCallback(() => {
        const newQuery = setTop(query, value);
        onQueryChange(newQuery);
    }, [onQueryChange, query, value]);
    return (React.createElement(Field, { label: "Top" },
        React.createElement(Input, { id: "azure-monitor-metrics-top-field", value: value, onChange: handleChange, onBlur: handleBlur, width: 16 })));
};
export default TopField;
//# sourceMappingURL=TopField.js.map