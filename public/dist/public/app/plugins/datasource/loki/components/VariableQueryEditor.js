import React, { useState, useEffect } from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { migrateVariableQuery } from '../migrations/variableQueryMigrations';
import { LokiVariableQueryType as QueryType } from '../types';
const variableOptions = [
    { label: 'Label names', value: QueryType.LabelNames },
    { label: 'Label values', value: QueryType.LabelValues },
];
const refId = 'LokiVariableQueryEditor-VariableQuery';
export const LokiVariableQueryEditor = ({ onChange, query, datasource }) => {
    const [type, setType] = useState(undefined);
    const [label, setLabel] = useState('');
    const [labelOptions, setLabelOptions] = useState([]);
    const [stream, setStream] = useState('');
    useEffect(() => {
        if (!query) {
            return;
        }
        const variableQuery = typeof query === 'string' ? migrateVariableQuery(query) : query;
        setType(variableQuery.type);
        setLabel(variableQuery.label || '');
        setStream(variableQuery.stream || '');
    }, [query]);
    useEffect(() => {
        if (type !== QueryType.LabelValues) {
            return;
        }
        datasource.labelNamesQuery().then((labelNames) => {
            setLabelOptions(labelNames.map(({ text }) => ({ label: text, value: text })));
        });
    }, [datasource, type]);
    const onQueryTypeChange = (newType) => {
        setType(newType.value);
        if (newType.value !== undefined) {
            onChange({
                type: newType.value,
                label,
                stream,
                refId,
            });
        }
    };
    const onLabelChange = (newLabel) => {
        setLabel(newLabel.value || '');
    };
    const onStreamChange = (e) => {
        setStream(e.currentTarget.value);
    };
    const handleBlur = () => {
        if (type !== undefined) {
            onChange({ type, label, stream, refId: 'LokiVariableQueryEditor-VariableQuery' });
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type", labelWidth: 20 },
                React.createElement(Select, { "aria-label": "Query type", onChange: onQueryTypeChange, onBlur: handleBlur, value: type, options: variableOptions, width: 16 })),
            type === QueryType.LabelValues && (React.createElement(React.Fragment, null,
                React.createElement(InlineField, { label: "Label", labelWidth: 20 },
                    React.createElement(Select, { "aria-label": "Label", onChange: onLabelChange, onBlur: handleBlur, value: { label: label, value: label }, options: labelOptions, width: 16, allowCustomValue: true }))))),
        type === QueryType.LabelValues && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Stream selector", labelWidth: 20, grow: true, tooltip: React.createElement("div", null, 'Optional. If defined, a list of values for the specified log stream selector is returned. For example: {label="value"} or {label="$variable"}') },
                React.createElement(Input, { type: "text", "aria-label": "Stream selector", placeholder: "Optional stream selector", value: stream, onChange: onStreamChange, onBlur: handleBlur }))))));
};
//# sourceMappingURL=VariableQueryEditor.js.map