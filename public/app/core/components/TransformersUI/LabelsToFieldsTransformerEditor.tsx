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

export const labelsToFieldsTransformerRegistryItem: TransformerRegistyItem<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  editor: LabelsAsFieldsTransformerEditor,
  transformation: standardTransformers.labelsToFieldsTransformer,
  name: 'Labels to fields',
  description: `Groups series by time and return labels or tags as fields. 
                Useful for showing time series with labels in a table where each label key becomes a seperate column`,
};
