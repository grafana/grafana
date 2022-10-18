import React, { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  SelectableValue,
} from '@grafana/data';
import { FilterFieldsByNameTransformerOptions } from '@grafana/data/src/transformations/transformers/filterByName';
import { InlineField, InlineFieldRow, ValuePicker, Button, HorizontalGroup } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';

import { partitionByValuesTransformer } from './partitionByValues';

export function PartitionByValuesEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FilterFieldsByNameTransformerOptions>) {
  const names = useFieldDisplayNames(input);
  const allSelectOptions = useSelectOptions(names);
  const selectOptions = useMemo(() => {
    const include = new Set(options.include?.names);
    if (include.size < 1) {
      return allSelectOptions;
    }
    return allSelectOptions.filter((v) => !include.has(v.value!));
  }, [allSelectOptions, options]);

  const addField = useCallback(
    (v: SelectableValue<string>) => {
      if (!v.value) {
        return;
      }
      const include = new Set(options.include?.names);
      include.add(v.value);
      onChange({
        ...options,
        include: { names: Array.from(include) },
      });
    },
    [onChange, options]
  );

  const removeField = useCallback(
    (v: string) => {
      if (!v) {
        return;
      }
      const include = new Set(options.include?.names);
      include.delete(v);
      onChange({
        ...options,
        include: { names: Array.from(include) },
      });
    },
    [onChange, options]
  );

  const include = Array.from(new Set(options.include?.names));
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

export const partitionByValuesTransformRegistryItem: TransformerRegistryItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  editor: PartitionByValuesEditor,
  transformation: partitionByValuesTransformer,
  name: partitionByValuesTransformer.name,
  description: partitionByValuesTransformer.description,
  state: PluginState.alpha,
};
