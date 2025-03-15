import { ChangeEvent, useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  FieldType,
  SelectableValue,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  getTimeZones,
} from '@grafana/data';
import { ConvertFieldTypeOptions, ConvertFieldTypeTransformerOptions } from '@grafana/data/internal';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { allFieldTypeIconOptions, FieldNamePicker } from '@grafana/ui/internal';
import { findField } from 'app/features/dimensions';

import { getTransformationContent } from '../docs/getTransformationContent';
import { getTimezoneOptions } from '../utils';

import { EnumMappingEditor } from './EnumMappingEditor';

const fieldNamePickerSettings = {
  settings: { width: 24, isClearable: false },
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

export const ConvertFieldTypeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<ConvertFieldTypeTransformerOptions>) => {
  const allTypes = allFieldTypeIconOptions.filter((v) => v.value !== FieldType.trace);
  const timeZoneOptions: Array<SelectableValue<string>> = getTimezoneOptions(true);

  // Format timezone options
  const tzs = getTimeZones();
  timeZoneOptions.push({ label: 'Browser', value: 'browser' });
  timeZoneOptions.push({ label: 'UTC', value: 'utc' });
  for (const tz of tzs) {
    timeZoneOptions.push({ label: tz, value: tz });
  }

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

  const onJoinWithChange = useCallback(
    (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], joinWith: e.currentTarget.value };
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

  const onTzChange = useCallback(
    (idx: number) => (value: SelectableValue<string>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], timezone: value?.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  return (
    <>
      {options.conversions.map((c: ConvertFieldTypeOptions, idx: number) => {
        const targetField = findField(input?.[0], c.targetField);
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
              {c.destinationType === FieldType.string && (
                <>
                  {(c.joinWith?.length || targetField?.type === FieldType.other) && (
                    <InlineField label="Join with" tooltip="Use an explicit separator when joining array values">
                      <Input value={c.joinWith} placeholder={'JSON'} onChange={onJoinWithChange(idx)} width={9} />
                    </InlineField>
                  )}
                  {targetField?.type === FieldType.time && (
                    <>
                      <InlineField label="Date format" tooltip="Specify the output format.">
                        <Input
                          value={c.dateFormat}
                          placeholder={'e.g. YYYY-MM-DD'}
                          onChange={onInputFormat(idx)}
                          width={24}
                        />
                      </InlineField>
                      <InlineField label="Set timezone" tooltip="Set the timezone of the date manually">
                        <Select options={timeZoneOptions} value={c.timezone} onChange={onTzChange(idx)} isClearable />
                      </InlineField>
                    </>
                  )}
                </>
              )}
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveConvertFieldType(idx)}
                aria-label={'Remove convert field type transformer'}
              />
            </InlineFieldRow>
            {c.destinationType === FieldType.enum && (
              <EnumMappingEditor input={input} options={options} transformIndex={idx} onChange={onChange} />
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
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.convertFieldType).helperDocs,
};
