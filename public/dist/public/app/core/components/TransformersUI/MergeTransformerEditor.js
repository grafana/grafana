import React from 'react';
import { DataTransformerID, standardTransformers } from '@grafana/data';
import { FieldValidationMessage } from '@grafana/ui';
export var MergeTransformerEditor = function (_a) {
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    if (input.length <= 1) {
        // Show warning that merge is useless only apply on a single frame
        return React.createElement(FieldValidationMessage, null, "Merge has no effect when applied on a single frame.");
    }
    return null;
};
export var mergeTransformerRegistryItem = {
    id: DataTransformerID.merge,
    editor: MergeTransformerEditor,
    transformation: standardTransformers.mergeTransformer,
    name: 'Merge',
    description: "Merge many series/tables and return a single table where mergeable values will be combined into the same row.\n                Useful for showing multiple series, tables or a combination of both visualized in a table.",
};
//# sourceMappingURL=MergeTransformerEditor.js.map