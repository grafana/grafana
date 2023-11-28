import React from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { FieldValidationMessage } from '@grafana/ui';
export const MergeTransformerEditor = ({ input, options, onChange }) => {
    if (input.length <= 1) {
        // Show warning that merge is useless only apply on a single frame
        return React.createElement(FieldValidationMessage, null, "Merge has no effect when applied on a single frame.");
    }
    return null;
};
export const mergeTransformerRegistryItem = {
    id: DataTransformerID.merge,
    editor: MergeTransformerEditor,
    transformation: standardTransformers.mergeTransformer,
    name: 'Merge',
    description: `Merge many series/tables and return a single table where mergeable values will be combined into the same row.
                Useful for showing multiple series, tables or a combination of both visualized in a table.`,
    categories: new Set([TransformerCategory.Combine]),
};
//# sourceMappingURL=MergeTransformerEditor.js.map