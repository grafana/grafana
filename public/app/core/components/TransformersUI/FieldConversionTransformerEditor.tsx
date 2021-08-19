import React, { useCallback } from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  FieldType,
  SelectableValue,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import {
  FieldConversionTransformerOptions,
  fieldConversionFieldInfo,
} from '@grafana/data/src/transformations/transformers/fieldConversion';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';

const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as any;

export const FieldConversionTransformerEditor: React.FC<TransformerUIProps<FieldConversionTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const allTypes: Array<SelectableValue<FieldType>> = [
    { value: FieldType.number, label: 'Numeric' },
    { value: FieldType.string, label: 'String' },
    { value: FieldType.time, label: 'Time' },
    { value: FieldType.boolean, label: 'Boolean' },
  ];

  const onSelectField = useCallback(
    (idx) => (value: string) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], targetField: value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onSelectDestinationType = useCallback(
    (idx) => (value: SelectableValue<FieldType>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], destinationType: value.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onInputFormat = useCallback(
    (idx) => (value: SelectableValue<string>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], dateFormat: value.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onAddFieldConversion = useCallback(() => {
    onChange({
      ...options,
      conversions: [
        ...options.conversions,
        { targetField: undefined, destinationType: undefined, dateFormat: undefined },
      ],
    });
  }, [onChange, options]);

  const onRemoveFieldConversion = useCallback(
    (idx) => {
      const removed = options.conversions;
      removed.splice(idx, 1);
      onChange({
        ...options,
        conversions: removed,
      });
    },
    [onChange, options]
  );

  //TODO
  //reformat size of inputs
  //show units for fields

  return (
    <>
      {options.conversions.map((c, idx) => {
        return (
          <InlineFieldRow key={`${c.targetField}-${idx}`}>
            <InlineField label={fieldConversionFieldInfo.targetField.label}>
              <FieldNamePicker
                context={{ data: input }}
                value={c.targetField || ''}
                onChange={onSelectField(idx)}
                item={dummyFieldSettings}
              />
            </InlineField>
            <InlineField label={fieldConversionFieldInfo.destinationType.label}>
              <Select
                menuShouldPortal
                options={allTypes}
                value={c.destinationType}
                placeholder={fieldConversionFieldInfo.destinationType.description}
                onChange={onSelectDestinationType(idx)}
                width={24}
              />
            </InlineField>
            {c.destinationType === FieldType.time && (
              <InlineField label={fieldConversionFieldInfo.dateFormat.label}>
                <Input
                  value={c.dateFormat}
                  placeholder={fieldConversionFieldInfo.dateFormat.description}
                  onChange={onInputFormat(idx)}
                  width={24}
                />
              </InlineField>
            )}
            <Button size="md" icon="trash-alt" variant="secondary" onClick={() => onRemoveFieldConversion(idx)} />
          </InlineFieldRow>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddFieldConversion}
        variant="secondary"
        aria-label={'Add field conversion'}
      >
        {'Field conversion'}
      </Button>
    </>
  );
};

export const fieldConversionTransformRegistryItem: TransformerRegistryItem<FieldConversionTransformerOptions> = {
  id: DataTransformerID.fieldConversion,
  editor: FieldConversionTransformerEditor,
  transformation: standardTransformers.fieldConversionTransformer,
  name: standardTransformers.fieldConversionTransformer.name,
  description: standardTransformers.fieldConversionTransformer.description,
};
