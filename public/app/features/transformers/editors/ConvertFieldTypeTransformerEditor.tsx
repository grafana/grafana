import React, { ChangeEvent, useCallback } from 'react';

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
  ConvertFieldTypeOptions,
  ConvertFieldTypeTransformerOptions,
} from '@grafana/data/src/transformations/transformers/convertFieldType';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { allFieldTypeIconOptions } from '@grafana/ui/src/components/MatchersUI/FieldTypeMatcherEditor';
import { hasAlphaPanels } from 'app/core/config';
import { findField } from 'app/features/dimensions';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24, isClearable: false },
} as any;

export const ConvertFieldTypeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<ConvertFieldTypeTransformerOptions>) => {
  const allTypes = allFieldTypeIconOptions.filter((v) => v.value !== FieldType.trace);

  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], targetField: value ?? '', dateFormat: undefined };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onSelectDestinationType = useCallback(
    (idx: number) => (value: SelectableValue<FieldType>) => {
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
    (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], dateFormat: e.currentTarget.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onAddConvertFieldType = useCallback(() => {
    onChange({
      ...options,
      conversions: [
        ...options.conversions,
        { targetField: undefined, destinationType: undefined, dateFormat: undefined },
      ],
    });
  }, [onChange, options]);

  const onRemoveConvertFieldType = useCallback(
    (idx: number) => {
      const removed = options.conversions;
      removed.splice(idx, 1);
      onChange({
        ...options,
        conversions: removed,
      });
    },
    [onChange, options]
  );

  return (
    <>
      {options.conversions.map((c: ConvertFieldTypeOptions, idx: number) => {
        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={'Field'}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <InlineField label={'as'}>
                <Select
                  options={allTypes}
                  value={c.destinationType}
                  placeholder={'Type'}
                  onChange={onSelectDestinationType(idx)}
                  width={18}
                />
              </InlineField>
              {c.destinationType === FieldType.time && (
                <InlineField
                  label="Input format"
                  tooltip="Specify the format of the input field so Grafana can parse the date string correctly."
                >
                  <Input
                    value={c.dateFormat}
                    placeholder={'e.g. YYYY-MM-DD'}
                    onChange={onInputFormat(idx)}
                    width={24}
                  />
                </InlineField>
              )}
              {c.destinationType === FieldType.string &&
                (c.dateFormat || findField(input?.[0], c.targetField)?.type === FieldType.time) && (
                  <InlineField label="Date format" tooltip="Specify the output format.">
                    <Input
                      value={c.dateFormat}
                      placeholder={'e.g. YYYY-MM-DD'}
                      onChange={onInputFormat(idx)}
                      width={24}
                    />
                  </InlineField>
                )}
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveConvertFieldType(idx)}
                aria-label={'Remove convert field type transformer'}
              />
            </InlineFieldRow>
            {c.destinationType === FieldType.enum && hasAlphaPanels && (
              <InlineFieldRow>
                <InlineField label={''} labelWidth={6}>
                  <div>TODO... show options here (alpha panels enabled)</div>
                </InlineField>
              </InlineFieldRow>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddConvertFieldType}
        variant="secondary"
        aria-label={'Add a convert field type transformer'}
      >
        {'Convert field type'}
      </Button>
    </>
  );
};

export const convertFieldTypeTransformRegistryItem: TransformerRegistryItem<ConvertFieldTypeTransformerOptions> = {
  id: DataTransformerID.convertFieldType,
  editor: ConvertFieldTypeTransformerEditor,
  transformation: standardTransformers.convertFieldTypeTransformer,
  name: standardTransformers.convertFieldTypeTransformer.name,
  description: standardTransformers.convertFieldTypeTransformer.description,
};
