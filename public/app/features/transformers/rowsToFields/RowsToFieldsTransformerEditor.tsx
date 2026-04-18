import { PluginState, type TransformerRegistryItem, type TransformerUIProps, TransformerCategory } from '@grafana/data';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import darkImage from '../images/dark/rowsToFields.svg';
import lightImage from '../images/light/rowsToFields.svg';

import { getRowsToFieldsTransformer, type RowToFieldsTransformOptions } from './rowsToFields';

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

export const getRowsToFieldsTransformRegistryItem: () => TransformerRegistryItem<RowToFieldsTransformOptions> = () => {
  const rowsToFieldsTransformer = getRowsToFieldsTransformer();
  return {
    id: rowsToFieldsTransformer.id,
    editor: RowsToFieldsTransformerEditor,
    transformation: rowsToFieldsTransformer,
    name: rowsToFieldsTransformer.name,
    description: rowsToFieldsTransformer.description,
    state: PluginState.beta,
    categories: new Set([TransformerCategory.Reformat]),
    imageDark: darkImage,
    imageLight: lightImage,
  };
};
