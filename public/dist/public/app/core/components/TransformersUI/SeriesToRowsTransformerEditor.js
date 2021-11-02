import { DataTransformerID, standardTransformers } from '@grafana/data';
export var SeriesToRowsTransformerEditor = function (_a) {
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    return null;
};
export var seriesToRowsTransformerRegistryItem = {
    id: DataTransformerID.seriesToRows,
    editor: SeriesToRowsTransformerEditor,
    transformation: standardTransformers.seriesToRowsTransformer,
    name: 'Series to rows',
    description: "Merge many series and return a single series with time, metric and value as columns.\n                Useful for showing multiple time series visualized in a table.",
};
//# sourceMappingURL=SeriesToRowsTransformerEditor.js.map