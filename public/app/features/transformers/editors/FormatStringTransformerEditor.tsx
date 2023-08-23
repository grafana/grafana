import React, { useCallback } from 'react';

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
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
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

  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Field'} labelWidth={12}>
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
            ]}
            value={options.outputFormat}
            onChange={onFormatChange}
          />
        </InlineField>
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
