import React from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { TransposeTransformerOptions } from '@grafana/data/src/transformations/transformers/transpose';
import { InlineField, InlineFieldRow, Input, RadioButtonGroup } from '@grafana/ui';

export const TransposeTransfomerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<TransposeTransformerOptions>) => {
  const addNewFields = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  return (
    <>
      <InlineFieldRow>
        <InlineField tooltip={'Adds new header field names to data frame'} label={'Add New Fields'} labelWidth={24}>
          <RadioButtonGroup
            options={addNewFields}
            value={options.addNewFields}
            onChange={(v) => onChange({ ...options, addNewFields: v })}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          tooltip={'Rename the first element of the data frame'}
          label={'Rename First Field'}
          labelWidth={24}
        >
          <Input
            placeholder="NewField"
            value={options.renameFirstField}
            onChange={(e) => onChange({ ...options, renameFirstField: e.currentTarget.value })}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const transposeTransformerRegistryItem: TransformerRegistryItem<TransposeTransformerOptions> = {
  id: DataTransformerID.transpose,
  editor: TransposeTransfomerEditor,
  transformation: standardTransformers.transposeTransformer,
  name: standardTransformers.transposeTransformer.name,
  description: standardTransformers.transposeTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
};
