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
} from '@grafana/data';
import { FormatStringOutput, FormatStringTransformerOptions } from '@grafana/data/internal';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { t } from 'app/core/internationalization';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    filter: (f) => f.type === FieldType.string,
    placeholderText: 'Select text field',
    noFieldsMessage: 'No text fields found',
  },
  name: '',
  id: '',
  editor: () => null,
};

function FormatStringTransfomerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FormatStringTransformerOptions>) {
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

  const ops = Object.values(FormatStringOutput).map((value) => ({ label: value, value }));

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
    </>
  );
}

export const formatStringTransformerRegistryItem: TransformerRegistryItem<FormatStringTransformerOptions> = {
  id: DataTransformerID.formatString,
  editor: FormatStringTransfomerEditor,
  transformation: standardTransformers.formatStringTransformer,
  name: standardTransformers.formatStringTransformer.name,
  state: PluginState.beta,
  description: standardTransformers.formatStringTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
};
