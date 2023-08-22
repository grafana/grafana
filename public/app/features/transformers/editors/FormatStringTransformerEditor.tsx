import React, { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  PluginState,
} from '@grafana/data';
import { FormatStringOutput, FormatStringTransformerOptions } from '@grafana/data/src/transformations/transformers/formatString';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';

export function FormatStringTransfomerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FormatStringTransformerOptions>) {
  const stringFields: Array<SelectableValue<string>> = [];

  // Get time fields
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.type === 'string') {
        const name = getFieldDisplayName(field, frame, input);
        stringFields.push({ label: name, value: name });
      }
    }
  }

  const onSelectField = useCallback(
    (value: SelectableValue<string>) => {
      const val = value?.value !== undefined ? value.value : '';
      onChange({
        ...options,
        stringField: val,
      });
    },
    [onChange, options]
  );

  const onFormatChange = useCallback(
    (value: SelectableValue<string>) => {
      const val = value.value ?? '';
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
        <InlineField label="String Field" labelWidth={15}>
          <Select
            options={stringFields}
            value={options.stringField}
            onChange={onSelectField}
            placeholder=""
          />
        </InlineField>

        <InlineField
          label="Format"
          labelWidth={10}
          interactive={true}
        >
          <Select
            options={[
              { label: FormatStringOutput.UpperCase, value: FormatStringOutput.UpperCase },
              { label: FormatStringOutput.LowerCase, value: FormatStringOutput.LowerCase },
              { label: FormatStringOutput.FirstLetter, value: FormatStringOutput.FirstLetter },
              { label: FormatStringOutput.EveryFirstLetter, value: FormatStringOutput.EveryFirstLetter },
              { label: FormatStringOutput.PascalCase, value: FormatStringOutput.PascalCase },
              { label: FormatStringOutput.CamelCase, value: FormatStringOutput.CamelCase },
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
