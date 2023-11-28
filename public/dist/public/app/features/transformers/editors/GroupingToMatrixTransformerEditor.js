import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, SpecialValue, TransformerCategory, } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';
export const GroupingToMatrixTransformerEditor = ({ input, options, onChange, }) => {
    const fieldNames = useAllFieldNamesFromDataFrames(input).map((item) => ({ label: item, value: item }));
    const onSelectColumn = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { columnField: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    const onSelectRow = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { rowField: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    const onSelectValue = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { valueField: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    const specialValueOptions = [
        { label: 'Null', value: SpecialValue.Null, description: 'Null value' },
        { label: 'True', value: SpecialValue.True, description: 'Boolean true value' },
        { label: 'False', value: SpecialValue.False, description: 'Boolean false value' },
        { label: 'Empty', value: SpecialValue.Empty, description: 'Empty string' },
    ];
    const onSelectEmptyValue = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { emptyValue: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Column", labelWidth: 8 },
                React.createElement(Select, { options: fieldNames, value: options.columnField, onChange: onSelectColumn, isClearable: true })),
            React.createElement(InlineField, { label: "Row", labelWidth: 8 },
                React.createElement(Select, { options: fieldNames, value: options.rowField, onChange: onSelectRow, isClearable: true })),
            React.createElement(InlineField, { label: "Cell Value", labelWidth: 10 },
                React.createElement(Select, { options: fieldNames, value: options.valueField, onChange: onSelectValue, isClearable: true })),
            React.createElement(InlineField, { label: "Empty Value" },
                React.createElement(Select, { options: specialValueOptions, value: options.emptyValue, onChange: onSelectEmptyValue, isClearable: true })))));
};
export const groupingToMatrixTransformRegistryItem = {
    id: DataTransformerID.groupingToMatrix,
    editor: GroupingToMatrixTransformerEditor,
    transformation: standardTransformers.groupingToMatrixTransformer,
    name: 'Grouping to matrix',
    description: 'Takes a three fields combination and produces a Matrix.',
    categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
};
//# sourceMappingURL=GroupingToMatrixTransformerEditor.js.map