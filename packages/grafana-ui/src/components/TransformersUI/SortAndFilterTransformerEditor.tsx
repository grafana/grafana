import React from 'react';
import { SortAndFilterFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/sortAndFilter';
import { TransformerUIRegistyItem, TransformerUIProps } from './types';
import { DataTransformerID, transformersRegistry } from '@grafana/data';

interface SortAndFilterTransformerEditorProps extends TransformerUIProps<SortAndFilterFieldsTransformerOptions> {}

const SortAndFilterTransformerEditor: React.FC<SortAndFilterTransformerEditorProps> = () => {
  return <span>hello</span>;
};

export const sortAndFilterTransformRegistryItem: TransformerUIRegistyItem<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  component: SortAndFilterTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.sortAndFilter),
  name: 'Arrange Fields',
  description: 'UI for sorting and hiding fields',
};
