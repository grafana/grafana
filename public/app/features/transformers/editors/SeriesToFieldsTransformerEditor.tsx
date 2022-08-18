import React, { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { SeriesToColumnsOptions, JoinMode } from '@grafana/data/src/transformations/transformers/seriesToColumns';
import { Select, InlineFieldRow, InlineField, RadioButtonGroup } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

const modes = [
  { value: JoinMode.outer, label: 'OUTER', description: 'Keep all rows that match' },
  { value: JoinMode.inner, label: 'INNER', description: 'Drop rows that do not match' },
];

export function SeriesToFieldsTransformerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<SeriesToColumnsOptions>) {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  const onSelectField = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        byField: value?.value,
      });
    },
    [onChange, options]
  );

  const onSetMode = useCallback(
    (mode: JoinMode) => {
      onChange({
        ...options,
        mode,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Mode" labelWidth={8}>
          <RadioButtonGroup options={modes} value={options.mode ?? JoinMode.outer} onChange={onSetMode} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={8}>
          <Select options={fieldNames} value={options.byField} onChange={onSelectField} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const seriesToFieldsTransformerRegistryItem: TransformerRegistryItem<SeriesToColumnsOptions> = {
  id: DataTransformerID.join,
  aliasIds: [DataTransformerID.seriesToColumns],
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.seriesToColumnsTransformer,
  name: standardTransformers.seriesToColumnsTransformer.name,
  description: standardTransformers.seriesToColumnsTransformer.description,
};
