import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
export const SeriesToRowsTransformerEditor = ({ input, options, onChange, }) => {
    return null;
};
export const seriesToRowsTransformerRegistryItem = {
    id: DataTransformerID.seriesToRows,
    editor: SeriesToRowsTransformerEditor,
    transformation: standardTransformers.seriesToRowsTransformer,
    name: 'Series to rows',
    description: `Merge many series and return a single series with time, metric and value as columns.
                Useful for showing multiple time series visualized in a table.`,
    categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
};
//# sourceMappingURL=SeriesToRowsTransformerEditor.js.map