import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { JoinMode } from '@grafana/data/src/transformations/transformers/joinByField';
import { getTemplateSrv } from '@grafana/runtime';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';
const modes = [
    {
        value: JoinMode.outer,
        label: 'OUTER (TIME SERIES)',
        description: 'Keep all rows from any table with a value. Join on distinct field values. Performant and best used for time series.',
    },
    {
        value: JoinMode.outerTabular,
        label: 'OUTER (TABULAR)',
        description: 'Join on a field value with duplicated values. Non performant outer join best used for tabular(SQL like) data.',
    },
    { value: JoinMode.inner, label: 'INNER', description: 'Drop rows that do not match a value in all tables.' },
];
export function SeriesToFieldsTransformerEditor({ input, options, onChange }) {
    var _a;
    const fieldNames = useAllFieldNamesFromDataFrames(input).map((item) => ({ label: item, value: item }));
    const variables = getTemplateSrv()
        .getVariables()
        .map((v) => {
        return { value: '$' + v.name, label: '$' + v.name };
    });
    const onSelectField = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { byField: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    const onSetMode = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { mode: value === null || value === void 0 ? void 0 : value.value }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Mode", labelWidth: 8, grow: true },
                React.createElement(Select, { options: modes, value: (_a = options.mode) !== null && _a !== void 0 ? _a : JoinMode.outer, onChange: onSetMode }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: 8, grow: true },
                React.createElement(Select, { options: [...fieldNames, ...variables], value: options.byField, onChange: onSelectField, placeholder: "time", isClearable: true })))));
}
export const joinByFieldTransformerRegistryItem = {
    id: DataTransformerID.joinByField,
    aliasIds: [DataTransformerID.seriesToColumns],
    editor: SeriesToFieldsTransformerEditor,
    transformation: standardTransformers.joinByFieldTransformer,
    name: standardTransformers.joinByFieldTransformer.name,
    description: standardTransformers.joinByFieldTransformer.description,
    categories: new Set([TransformerCategory.Combine]),
};
//# sourceMappingURL=JoinByFieldTransformerEditor.js.map