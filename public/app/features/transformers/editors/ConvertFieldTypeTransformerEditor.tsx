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
import { t, Trans } from '@grafana/i18n';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { getAllFieldTypeIconOptions, FieldNamePicker } from '@grafana/ui/internal';
import { findField } from 'app/features/dimensions/utils';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/convertFieldType.svg';
import lightImage from '../images/light/convertFieldType.svg';
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
  const allTypes = getAllFieldTypeIconOptions().filter((v) => v.value !== FieldType.trace);
  const timeZoneOptions: Array<SelectableValue<string>> = getTimezoneOptions(true);

  // Format timezone options
  const tzs = getTimeZones();
  timeZoneOptions.push({
    label: t('transformers.convert-field-type-transformer-editor.label.browser', 'Browser'),
    value: 'browser',
  });
  timeZoneOptions.push({
    label: t('transformers.convert-field-type-transformer-editor.label.utc', 'UTC'),
    value: 'utc',
  });
  for (const tz of tzs) {
    timeZoneOptions.push({ label: tz, value: tz });
  }

  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const conversions = [...options.conversions];
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

        // Show "Join with" input when:
        // - A join value exists (maintains backward compatibility)
        // - Target field type is 'other' (Grafana 10) or 'string' (Grafana 11)
        // This ensures consistent UI across versions where arrays may be classified differently.
        const shouldRenderJoinWith =
          c.joinWith?.length || (targetField?.type && [FieldType.other, FieldType.string].includes(targetField.type));

        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={t('transformers.convert-field-type-transformer-editor.label-field', 'Field')}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <InlineField label={t('transformers.convert-field-type-transformer-editor.label-as', 'as')}>
                <Select
                  options={allTypes}
                  value={c.destinationType}
                  placeholder={t('transformers.convert-field-type-transformer-editor.placeholder-type', 'Type')}
                  onChange={onSelectDestinationType(idx)}
                  width={18}
                />
              </InlineField>
              {c.destinationType === FieldType.time && (
                <InlineField
                  label={t('transformers.convert-field-type-transformer-editor.label-input-format', 'Input format')}
                  tooltip={t(
                    'transformers.convert-field-type-transformer-editor.tooltip-input-format',
                    'Specify the format of the input field so Grafana can parse the date string correctly.'
                  )}
                >
                  <Input
                    value={c.dateFormat}
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    placeholder={'e.g. YYYY-MM-DD'}
                    onChange={onInputFormat(idx)}
                    width={24}
                  />
                </InlineField>
              )}
              {c.destinationType === FieldType.string && (
                <>
                  {shouldRenderJoinWith && (
                    <InlineField
                      label={t('transformers.convert-field-type-transformer-editor.label-join-with', 'Join with')}
                      tooltip={t(
                        'transformers.convert-field-type-transformer-editor.tooltip-explicit-separator-joining-array-values',
                        'Use an explicit separator when joining array values'
                      )}
                    >
                      <Input
                        value={c.joinWith}
                        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                        placeholder={'JSON'}
                        onChange={onJoinWithChange(idx)}
                        width={16}
                      />
                    </InlineField>
                  )}
                  {targetField?.type === FieldType.time && (
                    <>
                      <InlineField
                        label={t('transformers.convert-field-type-transformer-editor.label-date-format', 'Date format')}
                        tooltip={t(
                          'transformers.convert-field-type-transformer-editor.tooltip-specify-the-output-format',
                          'Specify the output format.'
                        )}
                      >
                        <Input
                          value={c.dateFormat}
                          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                          placeholder={'e.g. YYYY-MM-DD'}
                          onChange={onInputFormat(idx)}
                          width={24}
                        />
                      </InlineField>
                      <InlineField
                        label={t(
                          'transformers.convert-field-type-transformer-editor.label-set-timezone',
                          'Set timezone'
                        )}
                        tooltip={t(
                          'transformers.convert-field-type-transformer-editor.tooltip-timezone-manually',
                          'Set the timezone of the date manually'
                        )}
                      >
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
                aria-label={t(
                  'transformers.convert-field-type-transformer-editor.aria-label-remove-convert-field-type-transformer',
                  'Remove convert field type transformer'
                )}
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
        aria-label={t(
          'transformers.convert-field-type-transformer-editor.aria-label-add-a-convert-field-type-transformer',
          'Add a convert field type transformer'
        )}
      >
        <Trans i18nKey="transformers.convert-field-type-transformer-editor.convert-field-type">
          Convert field type
        </Trans>
      </Button>
    </>
  );
};

export const getConvertFieldTypeTransformRegistryItem: () => TransformerRegistryItem<ConvertFieldTypeTransformerOptions> =
  () => ({
    id: DataTransformerID.convertFieldType,
    editor: ConvertFieldTypeTransformerEditor,
    transformation: standardTransformers.convertFieldTypeTransformer,
    name: t('transformers.convert-field-type-transformer-editor.name.convert-field-type', 'Convert field type'),
    description: t(
      'transformers.convert-field-type-transformer-editor.description.convert-to-specified-field-type',
      'Convert a field to a specified field type.'
    ),
    categories: new Set([TransformerCategory.Reformat]),
    help: getTransformationContent(DataTransformerID.convertFieldType).helperDocs,
    tags: new Set([t('transformers.convert-field-type-transformer-editor.tags.format-field', 'Format field')]),
    imageDark: darkImage,
    imageLight: lightImage,
  });
