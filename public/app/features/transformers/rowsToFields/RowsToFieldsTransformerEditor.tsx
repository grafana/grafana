import React from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

import { rowsToFieldsTransformer, RowToFieldsTransformOptions } from './rowsToFields';

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

This transforms rows into separate fields. This can be useful as fields can be styled and configured 
individually, something rows cannot. It can also use additional fields as sources for dynamic field 
configuration or map them to field labels. The additional labels can then be used to define better 
display names for the resulting fields.

Useful when visualization data in:
- Gauge
- Stat
- Pie chart

## Example

Input:

| Name    | Value | Max |
| ------- | ----- | --- |
| ServerA | 10    | 100 |
| ServerB | 20    | 200 |
| ServerC | 30    | 300 |

Output:

| ServerA (config: max=100) | ServerB (config: max=200) | ServerC (config: max=300) |
| ------------------------- | ------------------------- | ------------------------- |
| 10                        | 20                        | 30                        |

As you can see each row in the source data becomes a separate field. Each field now also has a max 
config option set. Options like **Min**, **Max**, **Unit** and **Thresholds** are all part of field 
configuration and if set like this will be used by the visualization instead of any options manually 
configured in the panel editor options pane.

`,
};
