import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { LabelsToFieldsOptions } from '@grafana/data/src/transformations/transformers/labelsToFields';

export const LabelsAsFieldsTransformerEditor: React.FC<TransformerUIProps<LabelsToFieldsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return null;
};

export const labelsToFieldsTransformerRegistryItem: TransformerRegistryItem<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  editor: LabelsAsFieldsTransformerEditor,
  transformation: standardTransformers.labelsToFieldsTransformer,
  name: 'Labels to fields',
  description: 'Groups series by time and return labels or tags as fields',
};
