import React from 'react';
import { SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { rowsToFieldsTransformer, RowToFieldsTransformOptions } from './rowsToFields';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';

interface Props extends TransformerUIProps<RowToFieldsTransformOptions> {}

export function RowsToFieldsTransformerEditor({ input, options, onChange }: Props) {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  const onChangeNameField = (value: SelectableValue<string>) => {
    onChange({ ...options, nameField: value.value });
  };

  const onChangeValueField = (value: SelectableValue<string>) => {
    onChange({ ...options, nameField: value.value });
  };

  if (input.length === 0) {
    return null;
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Name field" labelWidth={15}>
          <Select
            onChange={onChangeNameField}
            options={fieldNames}
            value={options.nameField}
            placeholder="Auto (first string field)"
            width={25}
          />
        </InlineField>
        <InlineField label="Value field" labelWidth={15}>
          <Select
            onChange={onChangeValueField}
            options={fieldNames}
            value={options.valueField}
            placeholder="Auto (first number field)"
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineLabel width={15}>Mappings</InlineLabel>
        <FieldToConfigMappingEditor
          frame={input[0]}
          mappings={options.mappings ?? []}
          onChange={(mappings) => onChange({ ...options, mappings })}
        />
      </InlineFieldRow>
    </div>
  );
}

export const rowsToFieldsTransformRegistryItem: TransformerRegistryItem<RowToFieldsTransformOptions> = {
  id: rowsToFieldsTransformer.id,
  editor: RowsToFieldsTransformerEditor,
  transformation: rowsToFieldsTransformer,
  name: rowsToFieldsTransformer.name,
  description: rowsToFieldsTransformer.description,
};
