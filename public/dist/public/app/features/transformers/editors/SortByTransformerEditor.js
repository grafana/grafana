import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineSwitch, InlineFieldRow, Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';
export const SortByTransformerEditor = ({ input, options, onChange }) => {
    var _a;
    const fieldNames = useAllFieldNamesFromDataFrames(input).map((item) => ({ label: item, value: item }));
    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => ({ label: '$' + v.name, value: '$' + v.name }));
    // Only supports single sort for now
    const onSortChange = useCallback((idx, cfg) => {
        onChange(Object.assign(Object.assign({}, options), { sort: [cfg] }));
    }, [onChange, options]);
    const sorts = ((_a = options.sort) === null || _a === void 0 ? void 0 : _a.length) ? options.sort : [{}];
    return (React.createElement("div", null, sorts.map((s, index) => {
        return (React.createElement(InlineFieldRow, { key: `${s.field}/${index}` },
            React.createElement(InlineField, { label: "Field", labelWidth: 10, grow: true },
                React.createElement(Select, { options: cfg.featureToggles.transformationsVariableSupport ? [...fieldNames, ...variables] : fieldNames, value: s.field, placeholder: "Select field", onChange: (v) => {
                        onSortChange(index, Object.assign(Object.assign({}, s), { field: v.value }));
                    } })),
            React.createElement(InlineField, { label: "Reverse" },
                React.createElement(InlineSwitch, { value: !!s.desc, onChange: () => {
                        onSortChange(index, Object.assign(Object.assign({}, s), { desc: !!!s.desc }));
                    } }))));
    })));
};
export const sortByTransformRegistryItem = {
    id: DataTransformerID.sortBy,
    editor: SortByTransformerEditor,
    transformation: standardTransformers.sortByTransformer,
    name: standardTransformers.sortByTransformer.name,
    description: standardTransformers.sortByTransformer.description,
    categories: new Set([TransformerCategory.ReorderAndRename]),
};
//# sourceMappingURL=SortByTransformerEditor.js.map