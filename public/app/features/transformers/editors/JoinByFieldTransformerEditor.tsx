import React, { useCallback, useEffect } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  DataFrame,
} from '@grafana/data';
import { JoinByFieldOptions, JoinMode } from '@grafana/data/src/transformations/transformers/joinByField';
import { Select, InlineFieldRow, InlineField, Checkbox, HorizontalGroup } from '@grafana/ui';

const modes = [
  { value: JoinMode.outer, label: 'OUTER', description: 'Keep all rows from any table with a value' },
  { value: JoinMode.inner, label: 'INNER', description: 'Drop rows that do not match a value in all tables' },
];

export function SeriesToFieldsTransformerEditor({ input, options, onChange }: TransformerUIProps<JoinByFieldOptions>) {
  useEffect(() => {
    if (options.fields && !Object.keys(options.fields).length && input.length && input[0].refId) {
      options.fields[input[0].refId] = input[0].fields[0].name;
      onChange({ ...options });
    }
  }, [onChange, options, input]);

  const onToggleDataFrame = useCallback(
    (dataFrame: DataFrame) => {
      if (!dataFrame.refId) {
        return;
      }

      if (options.fields) {
        if (dataFrame.refId in options.fields) {
          if (Object.keys(options.fields).length === 1) {
            return;
          }

          delete options.fields[dataFrame.refId];
        } else {
          options.fields[dataFrame.refId] = dataFrame.fields[0].name;
        }
      }

      onChange({ ...options });
    },
    [onChange, options]
  );

  const onSelectField = useCallback(
    (queryRefId: string | undefined, fieldName: SelectableValue<string>) => {
      if (queryRefId && fieldName.value) {
        onChange({
          ...options,
          fields: { ...options.fields, [queryRefId]: fieldName.value },
        });
      }
    },
    [onChange, options]
  );

  const onSetMode = useCallback(
    (value: SelectableValue<JoinMode>) => {
      onChange({
        ...options,
        mode: value?.value || JoinMode.outer,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Mode" labelWidth={8} grow>
          <Select options={modes} value={options.mode} onChange={onSetMode} />
        </InlineField>
      </InlineFieldRow>
      {input.map((dataFrame) => (
        <div className="gf-form-inline" key={dataFrame.refId}>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">
              {dataFrame.refId} ({dataFrame.name})
            </div>

            <HorizontalGroup>
              <Checkbox
                value={!!dataFrame.refId && options.fields && dataFrame.refId in options.fields}
                onChange={() => onToggleDataFrame(dataFrame)}
              />

              <Select
                options={dataFrame.fields.map((field) => ({ label: field.name, value: field.name }))}
                value={dataFrame.refId ? (options.fields || {})[dataFrame.refId] : dataFrame.fields[0].name}
                onChange={(fieldName) => onSelectField(dataFrame.refId, fieldName)}
              />
            </HorizontalGroup>
          </div>
        </div>
      ))}
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
};
