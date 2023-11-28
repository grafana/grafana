import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { GroupByOperationID, } from '@grafana/data/src/transformations/transformers/groupBy';
import { Stack } from '@grafana/experimental';
import { useTheme2, Select, StatsPicker, InlineField } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';
export const GroupByTransformerEditor = ({ input, options, onChange, }) => {
    const fieldNames = useAllFieldNamesFromDataFrames(input);
    const onConfigChange = useCallback((fieldName) => (config) => {
        onChange(Object.assign(Object.assign({}, options), { fields: Object.assign(Object.assign({}, options.fields), { [fieldName]: config }) }));
    }, 
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]);
    return (React.createElement("div", null, fieldNames.map((key) => (React.createElement(GroupByFieldConfiguration, { onConfigChange: onConfigChange(key), fieldName: key, config: options.fields[key], key: key })))));
};
const options = [
    { label: 'Group by', value: GroupByOperationID.groupBy },
    { label: 'Calculate', value: GroupByOperationID.aggregate },
];
export const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    const onChange = useCallback((value) => {
        var _a, _b;
        onConfigChange({
            aggregations: (_a = config === null || config === void 0 ? void 0 : config.aggregations) !== null && _a !== void 0 ? _a : [],
            operation: (_b = value === null || value === void 0 ? void 0 : value.value) !== null && _b !== void 0 ? _b : null,
        });
    }, [config, onConfigChange]);
    return (React.createElement(InlineField, { className: styles.label, label: fieldName, grow: true, shrink: true },
        React.createElement(Stack, { gap: 0.5, direction: "row", wrap: false },
            React.createElement("div", { className: styles.operation },
                React.createElement(Select, { options: options, value: config === null || config === void 0 ? void 0 : config.operation, placeholder: "Ignored", onChange: onChange, isClearable: true })),
            (config === null || config === void 0 ? void 0 : config.operation) === GroupByOperationID.aggregate && (React.createElement(StatsPicker, { className: styles.aggregations, placeholder: "Select Stats", allowMultiple: true, stats: config.aggregations, onChange: (stats) => {
                    onConfigChange(Object.assign(Object.assign({}, config), { aggregations: stats }));
                } })))));
};
const getStyles = (theme) => {
    return {
        label: css `
      label {
        min-width: ${theme.spacing(32)};
      }
    `,
        operation: css `
      flex-shrink: 0;
      height: 100%;
      width: ${theme.spacing(24)};
    `,
        aggregations: css `
      flex-grow: 1;
    `,
    };
};
export const groupByTransformRegistryItem = {
    id: DataTransformerID.groupBy,
    editor: GroupByTransformerEditor,
    transformation: standardTransformers.groupByTransformer,
    name: standardTransformers.groupByTransformer.name,
    description: standardTransformers.groupByTransformer.description,
    categories: new Set([
        TransformerCategory.Combine,
        TransformerCategory.CalculateNewFields,
        TransformerCategory.Reformat,
    ]),
};
//# sourceMappingURL=GroupByTransformerEditor.js.map