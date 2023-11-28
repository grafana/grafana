import React, { useEffect, useState } from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
export var TempoVariableQueryType;
(function (TempoVariableQueryType) {
    TempoVariableQueryType[TempoVariableQueryType["LabelNames"] = 0] = "LabelNames";
    TempoVariableQueryType[TempoVariableQueryType["LabelValues"] = 1] = "LabelValues";
})(TempoVariableQueryType || (TempoVariableQueryType = {}));
const variableOptions = [
    { label: 'Label names', value: TempoVariableQueryType.LabelNames },
    { label: 'Label values', value: TempoVariableQueryType.LabelValues },
];
const refId = 'TempoDatasourceVariableQueryEditor-VariableQuery';
export const TempoVariableQueryEditor = ({ onChange, query, datasource }) => {
    const [label, setLabel] = useState(query.label || '');
    const [type, setType] = useState(query.type);
    const [labelOptions, setLabelOptions] = useState([]);
    useEffect(() => {
        if (type === TempoVariableQueryType.LabelValues) {
            datasource.labelNamesQuery().then((labelNames) => {
                setLabelOptions(labelNames.map(({ text }) => ({ label: text, value: text })));
            });
        }
    }, [datasource, query, type]);
    const onQueryTypeChange = (newType) => {
        setType(newType.value);
        if (newType.value !== undefined) {
            onChange({
                type: newType.value,
                label,
                refId,
            });
        }
    };
    const onLabelChange = (newLabel) => {
        const newLabelValue = newLabel.value || '';
        setLabel(newLabelValue);
        if (type !== undefined) {
            onChange({
                type,
                label: newLabelValue,
                refId,
            });
        }
    };
    const handleBlur = () => {
        if (type !== undefined) {
            onChange({ type, label, refId });
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type", labelWidth: 20 },
                React.createElement(Select, { "aria-label": "Query type", onChange: onQueryTypeChange, onBlur: handleBlur, value: type, options: variableOptions, width: 32 }))),
        type === TempoVariableQueryType.LabelValues && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Label", labelWidth: 20 },
                React.createElement(Select, { "aria-label": "Label", onChange: onLabelChange, onBlur: handleBlur, value: { label, value: label }, options: labelOptions, width: 32, allowCustomValue: true }))))));
};
//# sourceMappingURL=VariableQueryEditor.js.map