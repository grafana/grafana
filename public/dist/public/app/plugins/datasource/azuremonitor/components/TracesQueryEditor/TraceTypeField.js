import React, { useCallback, useMemo } from 'react';
import { MultiSelect } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { findOptions } from '../../utils/common';
import { Field } from '../Field';
import { Tables } from './consts';
import { setTraceTypes } from './setQueryValue';
const TraceTypeField = ({ query, variableOptionGroup, onQueryChange }) => {
    var _a, _b;
    const tables = Object.entries(Tables).map(([key, value]) => ({
        label: value.label,
        description: value.description,
        value: key,
    }));
    const handleChange = useCallback((change) => {
        const newQuery = setTraceTypes(query, change.map((type) => { var _a; return (_a = type.value) !== null && _a !== void 0 ? _a : ''; }));
        onQueryChange(newQuery);
    }, [onQueryChange, query]);
    const options = useMemo(() => [...tables, variableOptionGroup], [tables, variableOptionGroup]);
    return (React.createElement(Field, { label: "Event Type" },
        React.createElement(MultiSelect, { placeholder: "Choose event types", inputId: "azure-monitor-traces-type-field", value: findOptions([...tables, ...variableOptionGroup.options], (_b = (_a = query.azureTraces) === null || _a === void 0 ? void 0 : _a.traceTypes) !== null && _b !== void 0 ? _b : []), onChange: handleChange, options: options, allowCustomValue: true, isClearable: true, "aria-label": selectors.components.queryEditor.tracesQueryEditor.traceTypes.select })));
};
export default TraceTypeField;
//# sourceMappingURL=TraceTypeField.js.map