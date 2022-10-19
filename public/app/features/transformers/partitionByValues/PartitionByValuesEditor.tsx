import React, { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  SelectableValue,
} from '@grafana/data';
import { InlineField, InlineFieldRow, ValuePicker, Button, HorizontalGroup, FieldValidationMessage } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';

import { partitionByValuesTransformer, PartitionByValuesTransformerOptions } from './partitionByValues';

export function PartitionByValuesEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<PartitionByValuesTransformerOptions>) {
  const names = useFieldDisplayNames(input);
  const allSelectOptions = useSelectOptions(names);
  const selectOptions = useMemo(() => {
    const fieldNames = new Set(options.fields.names);

    if (fieldNames.size < 1) {
      return allSelectOptions;
    }
    return allSelectOptions.filter((v) => !fieldNames.has(v.value!));
  }, [allSelectOptions, options]);

  const addField = useCallback(
    (v: SelectableValue<string>) => {
      if (!v.value) {
        return;
      }

      const fieldNames = new Set(options.fields.names);

      fieldNames.add(v.value);

      onChange({
        ...options,
        fields: { names: Array.from(fieldNames) },
      });
    },
    [onChange, options]
  );

  const removeField = useCallback(
    (v: string) => {
      if (!v) {
        return;
      }

      const fieldNames = new Set(options.fields.names);

      fieldNames.delete(v);

      onChange({
        ...options,
        fields: { names: Array.from(fieldNames) },
      });
    },
    [onChange, options]
  );

  if (input.length > 1) {
    return <FieldValidationMessage>Partition by values only works with a single frame.</FieldValidationMessage>;
  }

  const include = Array.from(new Set(options.fields.names));

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={10} grow={true}>
          <HorizontalGroup>
            {include.map((v) => (
              <Button key={v} icon="times" variant="secondary" size="md" onClick={() => removeField(v)}>
                {v}
              </Button>
            ))}
            {selectOptions.length && (
              <ValuePicker
                variant="secondary"
                size="md"
                options={selectOptions}
                onChange={addField}
                label="Select field"
                icon="plus"
              />
            )}
          </HorizontalGroup>
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

export const partitionByValuesTransformRegistryItem: TransformerRegistryItem<PartitionByValuesTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  editor: PartitionByValuesEditor,
  transformation: partitionByValuesTransformer,
  name: partitionByValuesTransformer.name,
  description: partitionByValuesTransformer.description,
  state: PluginState.alpha,
};
