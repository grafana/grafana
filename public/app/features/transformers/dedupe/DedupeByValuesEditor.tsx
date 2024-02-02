import React, { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  SelectableValue,
  TransformerCategory,
} from '@grafana/data';
import { InlineField, InlineFieldRow, ValuePicker, Button, HorizontalGroup, FieldValidationMessage } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';

import { getTransformationContent } from '../docs/getTransformationContent';

import { dedupeByValuesTransformer, DedupeByValuesTransformerOptions } from './dedupeByValues';

export function DedupeByValuesEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<DedupeByValuesTransformerOptions>) {
  const names = useFieldDisplayNames(input);
  const allSelectOptions = useSelectOptions(names);
  const selectOptions = useMemo(() => {
    const fieldNames = new Set(options.fields);

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

      const fieldNames = new Set(options.fields);

      fieldNames.add(v.value);

      onChange({
        ...options,
        fields: [...fieldNames],
      });
    },
    [onChange, options]
  );

  const removeField = useCallback(
    (v: string) => {
      if (!v) {
        return;
      }

      const fieldNames = new Set(options.fields);

      fieldNames.delete(v);

      onChange({
        ...options,
        fields: [...fieldNames],
      });
    },
    [onChange, options]
  );

  if (input.length > 1) {
    return <FieldValidationMessage>Partition by values only works with a single frame.</FieldValidationMessage>;
  }

  const fieldNames = [...new Set(options.fields)];

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={10} grow={true}>
          <HorizontalGroup>
            {fieldNames.map((name) => (
              <Button key={name} icon="times" variant="secondary" size="md" onClick={() => removeField(name)}>
                {name}
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

export const dedupeByValuesTransformRegistryItem: TransformerRegistryItem<DedupeByValuesTransformerOptions> = {
  id: DataTransformerID.dedupeByValues,
  editor: DedupeByValuesEditor,
  transformation: dedupeByValuesTransformer,
  name: dedupeByValuesTransformer.name,
  description: dedupeByValuesTransformer.description,
  state: PluginState.alpha,
  categories: new Set([TransformerCategory.Filter]),
  help: getTransformationContent(DataTransformerID.dedupeByValues).helperDocs,
};
