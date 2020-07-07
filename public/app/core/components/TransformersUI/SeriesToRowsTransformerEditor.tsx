import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { SeriesToRowsTransformerOptions } from '@grafana/data/src/transformations/transformers/seriesToRows';

export const SeriesToRowsTransformerEditor: React.FC<TransformerUIProps<SeriesToRowsTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return null;
};

export const seriesToRowsTransformerRegistryItem: TransformerRegistyItem<SeriesToRowsTransformerOptions> = {
  id: DataTransformerID.seriesToRows,
  editor: SeriesToRowsTransformerEditor,
  transformation: standardTransformers.seriesToRowsTransformer,
  name: 'Series to rows',
  description: `Merge series and return a single series with metric name as a column. 
                Useful for showing multiple time series visualized in a table.`,
};
