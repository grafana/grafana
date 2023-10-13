import React, { useCallback, ChangeEvent } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  PluginState,
  getTimeZones,
} from '@grafana/data';
import { FormatTimeTransformerOptions } from '@grafana/data/src/transformations/transformers/formatTime';
import { Select, InlineFieldRow, InlineField, Input } from '@grafana/ui';

export function FormatTimeTransfomerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FormatTimeTransformerOptions>) {
  const timeFields: Array<SelectableValue<string>> = [];
  const timeZoneOptions: Array<SelectableValue<string>> = [];

  // Get time fields
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.type === 'time') {
        const name = getFieldDisplayName(field, frame, input);
        timeFields.push({ label: name, value: name });
      }
    }
  }

  // Format timezone options
  const tzs = getTimeZones(false);
  
  for (const tz of tzs) {
    if (tz.length > 0) {
      timeZoneOptions.push({ label: tz, value: tz });
    }
  }

  const onSelectField = useCallback(
    (value: SelectableValue<string>) => {
      const val = value?.value !== undefined ? value.value : '';
      onChange({
        ...options,
        timeField: val,
      });
    },
    [onChange, options]
  );

  const onFormatChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange({
        ...options,
        outputFormat: val,
      });
    },
    [onChange, options]
  );

  const onTzChange = useCallback(
    (value: SelectableValue<string>) => {
      const val = value?.value !== undefined ? value.value : '';
      onChange({
        ...options,
        timezone: val,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Time Field" labelWidth={15} grow>
          <Select
            options={timeFields}
            value={options.timeField}
            onChange={onSelectField}
            placeholder="time"
            isClearable
          />
        </InlineField>

        <InlineField
          label="Format"
          labelWidth={10}
          tooltip={
            <>
              The output format for the field specified as a{' '}
              <a href="https://momentjs.com/docs/#/displaying/" target="_blank" rel="noopener noreferrer">
                Moment.js format string
              </a>
              .
            </>
          }
          interactive={true}
        >
          <Input onChange={onFormatChange} value={options.outputFormat} />
        </InlineField>
        <InlineField label="Set Timezone" tooltip="Set the timezone of the date manually" labelWidth={20}>
          <Select options={timeZoneOptions} value={options.timezone} onChange={onTzChange} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const formatTimeTransformerRegistryItem: TransformerRegistryItem<FormatTimeTransformerOptions> = {
  id: DataTransformerID.formatTime,
  editor: FormatTimeTransfomerEditor,
  transformation: standardTransformers.formatTimeTransformer,
  name: standardTransformers.formatTimeTransformer.name,
  state: PluginState.alpha,
  description: standardTransformers.formatTimeTransformer.description,
};
