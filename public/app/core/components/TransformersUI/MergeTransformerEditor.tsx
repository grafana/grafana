import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { MergeTransformerOptions } from '@grafana/data/src/transformations/transformers/merge/merge';

export const MergeTransformerEditor: React.FC<TransformerUIProps<MergeTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return null;
};

export const mergeTransformerRegistryItem: TransformerRegistyItem<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  editor: MergeTransformerEditor,
  transformation: standardTransformers.mergeTransformer,
  name: 'Merge on time',
  description: `Merge series/tables by time and return a single table with values as rows. 
                Useful for showing multiple time series, tables or a combination of both visualized in a table.`,
};
