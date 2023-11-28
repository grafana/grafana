import React, { useCallback } from 'react';
import { EditorHeader, InlineSelect } from '@grafana/experimental';
import { selectors } from '../e2e/selectors';
import { AzureQueryType } from '../types';
export const QueryHeader = ({ query, onQueryChange }) => {
    const queryTypes = [
        { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
        { value: AzureQueryType.LogAnalytics, label: 'Logs' },
        { value: AzureQueryType.AzureTraces, label: 'Traces' },
        { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
    ];
    const handleChange = useCallback((change) => {
        if (change.value && change.value !== query.queryType) {
            onQueryChange({
                refId: query.refId,
                datasource: query.datasource,
                queryType: change.value,
            });
        }
    }, [onQueryChange, query]);
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.header.select },
        React.createElement(EditorHeader, null,
            React.createElement(InlineSelect, { label: "Service", value: query.queryType, placeholder: "Service...", allowCustomValue: true, options: queryTypes, onChange: handleChange }))));
};
//# sourceMappingURL=QueryHeader.js.map