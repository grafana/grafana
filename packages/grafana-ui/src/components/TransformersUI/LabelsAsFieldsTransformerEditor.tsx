import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { LabelsAsColumnsOptions } from '@grafana/data/src/transformations/transformers/labelsAsColumns';

export const LabelsAsFieldsTransformerEditor: React.FC<TransformerUIProps<LabelsAsColumnsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return <div />;
};

export const labelsAsFieldsTransformerRegistryItem: TransformerRegistyItem<LabelsAsColumnsOptions> = {
  id: DataTransformerID.labelsAsColumns,
  editor: LabelsAsFieldsTransformerEditor,
  transformation: standardTransformers.labelsAsColumnsTransformer,
  name: 'Labels as fields',
  description: 'Groups series by time and return labels as fields',
};
