import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { LabelsToFieldsOptions } from '@grafana/data/src/transformations/transformers/labelsToFields';

export const LabelsAsFieldsTransformerEditor: React.FC<TransformerUIProps<LabelsToFieldsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return null;
};

export const labelsAsFieldsTransformerRegistryItem: TransformerRegistyItem<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  editor: LabelsAsFieldsTransformerEditor,
  transformation: standardTransformers.labelsToFieldsTransformer,
  name: 'Labels as fields',
  description: 'Groups series by time and return labels as fields',
};
