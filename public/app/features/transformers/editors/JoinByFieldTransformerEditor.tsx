import React, { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { JoinByFieldOptions, JoinMode } from '@grafana/data/src/transformations/transformers/joinByField';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

const modes = [
  { value: JoinMode.outer, label: 'OUTER', description: 'Keep all rows from any table with a value' },
  { value: JoinMode.inner, label: 'INNER', description: 'Drop rows that do not match a value in all tables' },
];

export function SeriesToFieldsTransformerEditor({ input, options, onChange }: TransformerUIProps<JoinByFieldOptions>) {
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
    (value: SelectableValue<JoinMode>) => {
      onChange({
        ...options,
        mode: value?.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Mode" labelWidth={8} grow>
          <Select options={modes} value={options.mode ?? JoinMode.outer} onChange={onSetMode} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={8} grow>
          <Select
            options={fieldNames}
            value={options.byField}
            onChange={onSelectField}
            placeholder="time"
            isClearable
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const joinByFieldTransformerRegistryItem: TransformerRegistryItem<JoinByFieldOptions> = {
  id: DataTransformerID.joinByField,
  aliasIds: [DataTransformerID.seriesToColumns],
  editor: SeriesToFieldsTransformerEditor,
  transformation: standardTransformers.joinByFieldTransformer,
  name: standardTransformers.joinByFieldTransformer.name,
  description: standardTransformers.joinByFieldTransformer.description,
  categories: new Set([TransformerCategory.Combine]),
};
