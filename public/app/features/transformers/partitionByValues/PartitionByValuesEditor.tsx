import { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  SelectableValue,
  TransformerCategory,
} from '@grafana/data';
import {
  InlineField,
  InlineFieldRow,
  ValuePicker,
  Button,
  HorizontalGroup,
  FieldValidationMessage,
  RadioButtonGroup,
} from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';

import { getTransformationContent } from '../docs/getTransformationContent';

import { partitionByValuesTransformer, PartitionByValuesTransformerOptions } from './partitionByValues';

export function PartitionByValuesEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<PartitionByValuesTransformerOptions>) {
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

  enum namingModes {
    asLabels,
    frameName,
  }

  const namingModesOptions = [
    { label: 'As label', value: namingModes.asLabels },
    { label: 'As frame name', value: namingModes.frameName },
  ];

  const KeepFieldsOptions = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

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
      <InlineFieldRow>
        <InlineField
          tooltip={
            'Sets how the names of the selected fields are displayed. As frame name is usually better for tabular data'
          }
          label={'Naming'}
          labelWidth={10}
        >
          <RadioButtonGroup
            options={namingModesOptions}
            value={
              options.naming?.asLabels === undefined || options.naming.asLabels
                ? namingModes.asLabels
                : namingModes.frameName
            }
            onChange={(v) =>
              onChange({ ...options, naming: { ...options.naming, asLabels: v === namingModes.asLabels } })
            }
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField tooltip={'Keeps the partition fields in the frames.'} label={'Keep fields'} labelWidth={16}>
          <RadioButtonGroup
            options={KeepFieldsOptions}
            value={options.keepFields}
            onChange={(v) => onChange({ ...options, keepFields: v })}
          />
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
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.partitionByValues).helperDocs,
};
