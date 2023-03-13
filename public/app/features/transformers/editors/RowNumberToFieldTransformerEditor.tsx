import React from 'react';

import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { RowNumberToFieldTransformerOptions } from '@grafana/data/src/transformations/transformers/rowNumberToField';

export const RowNumberToFieldTransformerEditor: React.FC<TransformerUIProps<RowNumberToFieldTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return null;
};

export const rowNumberToFieldTransformerRegistryItem: TransformerRegistryItem<RowNumberToFieldTransformerOptions> = {
  id: DataTransformerID.rowNumberToField,
  editor: RowNumberToFieldTransformerEditor,
  transformation: standardTransformers.rowNumberToFieldTransformer,
  name: 'Row number to field',
  description: 'Add the row number of the data frame as a field',
};
