import React from 'react';

import { PluginState, SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { renameByMappingTransformer, RenameByMappingTransformOptions, getVariablesList } from './renameByMapping';

export interface Props extends TransformerUIProps<RenameByMappingTransformOptions> {}

export function RenameByMappingTransformerEditor({ input, options, onChange }: Props) {
  const varsList = getVariablesList();
  const currentVariable = options.varName;

  const onVarChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      varName: value.value,
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Mapping Variable" labelWidth={20}>
          <Select onChange={onVarChange} options={varsList} value={currentVariable} width={30} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const renameByMappingTransformRegistryItem: TransformerRegistryItem<RenameByMappingTransformOptions> = {
  id: renameByMappingTransformer.id,
  editor: RenameByMappingTransformerEditor,
  transformation: renameByMappingTransformer,
  name: renameByMappingTransformer.name,
  description: renameByMappingTransformer.description,
  state: PluginState.beta,
  help: `
  Rename Fields in result frames using a text/value style template variable.
  `,
};
