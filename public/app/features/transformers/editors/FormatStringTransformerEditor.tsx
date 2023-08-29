import React, { FormEvent, useCallback } from 'react';

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
} from '@grafana/data';
import {
  FormatStringOutput,
  FormatStringTransformerOptions,
} from '@grafana/data/src/transformations/transformers/formatString';
import { Select, InlineFieldRow, InlineField, Input } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

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

export function FormatStringTransfomerEditor({
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
    (e: FormEvent<HTMLInputElement>) => {
      const startVal = Number(e.currentTarget.value) ?? 0;
      onChange({
        ...options,
        substringStart: startVal,
      });
    },
    [onChange, options]
  );

  const onSubstringEndChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      const endVal = Number(e.currentTarget.value) ?? 0;
      onChange({
        ...options,
        substringEnd: endVal,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Field'} labelWidth={10}>
          <FieldNamePicker
            context={{ data: input }}
            value={options.stringField ?? ''}
            onChange={onSelectField}
            item={fieldNamePickerSettings}
          />
        </InlineField>

        <InlineField label="Format" labelWidth={10}>
          <Select
            options={[
              { label: FormatStringOutput.UpperCase, value: FormatStringOutput.UpperCase },
              { label: FormatStringOutput.LowerCase, value: FormatStringOutput.LowerCase },
              { label: FormatStringOutput.SentenceCase, value: FormatStringOutput.SentenceCase },
              { label: FormatStringOutput.TitleCase, value: FormatStringOutput.TitleCase },
              { label: FormatStringOutput.PascalCase, value: FormatStringOutput.PascalCase },
              { label: FormatStringOutput.CamelCase, value: FormatStringOutput.CamelCase },
              { label: FormatStringOutput.SnakeCase, value: FormatStringOutput.SnakeCase },
              { label: FormatStringOutput.KebabCase, value: FormatStringOutput.KebabCase },
              { label: FormatStringOutput.Trim, value: FormatStringOutput.Trim },
              { label: FormatStringOutput.Substring, value: FormatStringOutput.Substring },
            ]}
            value={options.outputFormat}
            onChange={onFormatChange}
          />
        </InlineField>

        {options.outputFormat === FormatStringOutput.Substring && 
          <InlineFieldRow>
            <InlineField label="Start" labelWidth={7}>
              <Input
                pattern="[0-9]*"
                value={options.substringStart}
                onChange={onSubstringStartChange}
                width={7}
              />
            </InlineField>
            <InlineField label="End" labelWidth={7}>
            <Input
              pattern="[0-9]*"
              value={options.substringEnd}
              onChange={onSubstringEndChange}
              width={7}
            />
          </InlineField>
        </InlineFieldRow>
        }

      </InlineFieldRow>
    </>
  );
}

export const formatStringTransformerRegistryItem: TransformerRegistryItem<FormatStringTransformerOptions> = {
  id: DataTransformerID.formatString,
  editor: FormatStringTransfomerEditor,
  transformation: standardTransformers.formatStringTransformer,
  name: standardTransformers.formatStringTransformer.name,
  state: PluginState.alpha,
  description: standardTransformers.formatStringTransformer.description,
};
