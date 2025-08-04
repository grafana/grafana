import { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  PluginState,
  FieldType,
  StandardEditorsRegistryItem,
  FieldNamePickerConfigSettings,
  TransformerCategory,
  StringFieldConfigSettings,
} from '@grafana/data';
import { FormatStringOutput, FormatStringTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';

import darkImage from '../images/dark/formatString.svg';
import lightImage from '../images/light/formatString.svg';

function FormatStringTransfomerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FormatStringTransformerOptions>) {
  const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
    settings: {
      width: 30,
      filter: (f) => f.type === FieldType.string,
      placeholderText: t(
        'transformers.format-string-transfomer-editor.field-name-picker-settings.placeholderText.select-text-field',
        'Select text field'
      ),
      noFieldsMessage: t(
        'transformers.format-string-transfomer-editor.field-name-picker-settings.noFieldsMessage.no-text-fields-found',
        'No text fields found'
      ),
    },
    name: '',
    id: '',
    editor: () => null,
  };

  const onSelectField = useCallback(
    (value: string | undefined) => {
      const val = value ?? '';
      onChange({
        ...options,
        stringField: val,
      });
    },
    [onChange, options]
  );

  const onFormatChange = useCallback(
    (value: SelectableValue<FormatStringOutput>) => {
      const val = value.value ?? FormatStringOutput.UpperCase;
      onChange({
        ...options,
        outputFormat: val,
      });
    },
    [onChange, options]
  );

  const onSubstringStartChange = useCallback(
    (value?: number) => {
      onChange({
        ...options,
        substringStart: value ?? 0,
      });
    },
    [onChange, options]
  );

  const onSubstringEndChange = useCallback(
    (value?: number) => {
      onChange({
        ...options,
        substringEnd: value ?? 0,
      });
    },
    [onChange, options]
  );

  const onPrefixChange = useCallback(
    (value?: string) => {
      onChange({
        ...options,
        stringPrefix: value ?? '',
      });
    },
    [onChange, options]
  );

  const onSuffixChange = useCallback(
    (value?: string) => {
      onChange({
        ...options,
        stringSuffix: value ?? '',
      });
    },
    [onChange, options]
  );

  const ops = Object.values(FormatStringOutput).map((value) => ({ label: value, value }));

  const dummyStringSettings = {
    settings: {},
  } as StandardEditorsRegistryItem<string, StringFieldConfigSettings>;

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('transformers.format-string-transfomer-editor.label-field', 'Field')} labelWidth={10}>
          <FieldNamePicker
            context={{ data: input }}
            value={options.stringField ?? ''}
            onChange={onSelectField}
            item={fieldNamePickerSettings}
          />
        </InlineField>

        <InlineField label={t('transformers.format-string-transfomer-editor.label-format', 'Format')} labelWidth={10}>
          <Select options={ops} value={options.outputFormat} onChange={onFormatChange} width={20} />
        </InlineField>
      </InlineFieldRow>

      {options.outputFormat === FormatStringOutput.Substring && (
        <InlineFieldRow>
          <InlineField
            label={t('transformers.format-string-transfomer-editor.label-substring-range', 'Substring range')}
            labelWidth={15}
          >
            <NumberInput min={0} value={options.substringStart ?? 0} onChange={onSubstringStartChange} width={7} />
          </InlineField>
          <InlineField>
            <NumberInput min={0} value={options.substringEnd ?? 0} onChange={onSubstringEndChange} width={7} />
          </InlineField>
        </InlineFieldRow>
      )}
      {options.outputFormat === FormatStringOutput.Affix && (
        <InlineFieldRow>
          <InlineField label={t('transformers.format-string-transfomer-editor.label-prefix', 'Prefix')} labelWidth={15}>
            <StringValueEditor
              context={{ data: input }}
              value={options.stringPrefix ?? ''} 
              onChange={onPrefixChange} 
              item={dummyStringSettings}
              preserveWhitespace={true}
              />
          </InlineField>

          <InlineField label={t('transformers.format-string-transfomer-editor.label-suffix', 'Suffix')} labelWidth={15}>
            <StringValueEditor
              context={{ data: input }}
              value={options.stringSuffix ?? ''} 
              onChange={onSuffixChange} 
              item={dummyStringSettings}
              preserveWhitespace={true}
              />              
          </InlineField>
        </InlineFieldRow>
      )}      
    </>
  );
}

export const getFormatStringTransformerRegistryItem: () => TransformerRegistryItem<FormatStringTransformerOptions> =
  () => ({
    id: DataTransformerID.formatString,
    editor: FormatStringTransfomerEditor,
    transformation: standardTransformers.formatStringTransformer,
    name: t('transformers.format-string-transformer-editor.name.format-string', 'Format string'),
    state: PluginState.beta,
    description: t(
      'transformers.format-string-transformer-editor.description.manipulate-string-fields-formatting',
      'Manipulate string fields formatting.'
    ),
    categories: new Set([TransformerCategory.Reformat]),
    imageDark: darkImage,
    imageLight: lightImage,
  });
