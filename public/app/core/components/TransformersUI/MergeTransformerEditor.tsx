import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { MergeTransformerOptions } from '@grafana/data/src/transformations/transformers/merge';

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
  name: 'Merge',
  description: `Merge many series/tables and return a single table where mergeable values will be combined into the same row. 
                Useful for showing multiple series, tables or a combination of both visualized in a table.`,
};
