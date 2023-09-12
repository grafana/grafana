import React from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps, TransformerCategory } from '@grafana/data';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import { getHelperContent } from '../helpers/getHelperContent';

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
  categories: new Set([TransformerCategory.Reformat]),
  help: getHelperContent(rowsToFieldsTransformer.id),
};
