import React from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { AutoMinMaxPerFieldTransformerOptions } from '@grafana/data/src/transformations/transformers/autoMinMaxPerField';

export const AutoMinMaxPerFieldTransformerEditor: React.FC<TransformerUIProps<
  AutoMinMaxPerFieldTransformerOptions
>> = ({ input, options, onChange }) => {
  return null;
};

export const autoMinMaxPerFieldTransformerRegistryItem: TransformerRegistyItem<AutoMinMaxPerFieldTransformerOptions> = {
  id: DataTransformerID.autoMinMaxPerField,
  editor: AutoMinMaxPerFieldTransformerEditor,
  transformation: standardTransformers.autoMinMaxPerFieldTransformer,
  name: 'Calculate min/max per field',
  description: `Calculate min/max per field instead of globally.
                Useful for bar gauge table cells.`,
};
