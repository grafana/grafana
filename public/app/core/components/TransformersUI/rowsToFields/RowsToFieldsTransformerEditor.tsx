import React from 'react';
import { PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { rowsToFieldsTransformer, RowToFieldsTransformOptions } from './rowsToFields';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

export interface Props extends TransformerUIProps<RowToFieldsTransformOptions> {}

export function RowsToFieldsTransformerEditor({ input, options, onChange }: Props) {
  if (input.length === 0) {
    return null;
  }

  return (
    <div>
      <FieldToConfigMappingEditor
        frame={input[0]}
        mappings={options.mappings ?? []}
        onChange={(mappings) => onChange({ ...options, mappings })}
        withNameAndValue={true}
      />
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
