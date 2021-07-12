import React from 'react';
import { PluginState, SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { rowsToFieldsTransformer, RowToFieldsTransformOptions } from './rowsToFields';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';

export interface Props extends TransformerUIProps<RowToFieldsTransformOptions> {}

export function RowsToFieldsTransformerEditor({ input, options, onChange }: Props) {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  const onChangeNameField = (value: SelectableValue<string>) => {
    onChange({ ...options, nameField: value.value });
  };

  const onChangeValueField = (value: SelectableValue<string>) => {
    onChange({ ...options, valueField: value.value });
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
            width={30}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Value field" labelWidth={15}>
          <Select
            onChange={onChangeValueField}
            options={fieldNames}
            value={options.valueField}
            placeholder="Auto (first number field)"
            width={30}
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
  state: PluginState.beta,
  help: `
### Use cases 

This transformation transforms rows into separate fields. This can be useful as fields can be styled 
and configured individually, something rows cannot. It can also use additional fields as sources for
data driven configuration or as sources for field labels. The additional labels can then be used to 
define better display names for the resulting fields.

Useful when visualization data in: 
* Gauge 
* Stat 
* Pie chart

### Configuration overview

* Select one field to use as the source of names for the new fields.
* Select one field to use as the values for the fields.
* Optionally map extra fields to config properties like min and max.

### Examples

Input:

Name    | Value | Max
--------|-------|------
ServerA | 10    | 100
ServerB | 20    | 200
ServerC | 30    | 300

Output:

ServerA (max=100) | ServerB (max=200) | ServerC (max=300)
------------------|------------------ | ------------------
10                | 20                | 30

`,
};
