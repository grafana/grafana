import React from 'react';
import {
  DataTransformerID,
  PluginState,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { fieldsToLabelsTransformer, FieldsToLabelsTransformOptions } from './fieldsToLabels';
import { MultiSelect } from '@grafana/ui';

export interface Props extends TransformerUIProps<FieldsToLabelsTransformOptions> {}

export function FieldsToLabelsTransformEditor({ input, options, onChange }: Props) {
  if (input.length === 0) {
    return null;
  }

  const fieldNames: Array<SelectableValue<string>> = [];
  const uniqueFields: Record<string, boolean> = {};

  for (const frame of input) {
    for (const field of frame.fields) {
      if (!uniqueFields[field.name]) {
        fieldNames.push({ value: field.name, label: field.name });
        uniqueFields[field.name] = true;
      }
    }
  }

  const onLabelFieldsChange = (values: Array<SelectableValue<string>> | null) => {
    onChange({ labelFields: values?.map((value) => value.value || '') });
  };

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <div className="gf-form-label width-8">Label fields</div>
        <MultiSelect
          menuShouldPortal
          isClearable={true}
          allowCustomValue={false}
          placeholder="Select label fields"
          options={fieldNames}
          className="min-width-18 gf-form-spacing"
          value={options?.labelFields}
          onChange={onLabelFieldsChange}
        />
      </div>
    </div>
  );
}

export const fieldsToLabelsTransformerRegistryItem: TransformerRegistryItem<FieldsToLabelsTransformOptions> = {
  id: DataTransformerID.fieldsToLabels,
  editor: FieldsToLabelsTransformEditor,
  transformation: fieldsToLabelsTransformer,
  name: fieldsToLabelsTransformer.name,
  description: fieldsToLabelsTransformer.description,
  state: PluginState.beta,
};
