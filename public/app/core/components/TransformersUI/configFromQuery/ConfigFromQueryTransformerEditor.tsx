import React from 'react';
import { SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { configFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

export function ConfigFromQueryTransformerEditor({ input, onChange, options }: Props) {
  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId || 'config';
  const configFrame = input.find((x) => x.refId === currentRefId);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      configRefId: value.value || 'config',
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Config query" labelWidth={20}>
          <Select onChange={onRefIdChange} options={refIds} value={currentRefId} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineLabel width={20}>Mappings</InlineLabel>
        {configFrame && (
          <FieldToConfigMappingEditor
            frame={configFrame}
            mappings={options.mappings}
            onChange={(mappings) => onChange({ ...options, mappings })}
          />
        )}
      </InlineFieldRow>
    </>
  );
}

export const configFromQueryTransformRegistryItem: TransformerRegistryItem<ConfigFromQueryTransformOptions> = {
  id: configFromDataTransformer.id,
  editor: ConfigFromQueryTransformerEditor,
  transformation: configFromDataTransformer,
  name: configFromDataTransformer.name,
  description: configFromDataTransformer.description,
};
