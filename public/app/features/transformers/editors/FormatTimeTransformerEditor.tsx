import { useCallback, ChangeEvent } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  PluginState,
} from '@grafana/data';
import { FormatTimeTransformerOptions } from '@grafana/data/internal';
import { Select, InlineFieldRow, InlineField, Input, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';
import { getTimezoneOptions } from '../utils';

export function FormatTimeTransfomerEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<FormatTimeTransformerOptions>) {
  const timeFields: Array<SelectableValue<string>> = [];
  const timeZoneOptions: Array<SelectableValue<string>> = getTimezoneOptions(true);

  // Get time fields
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.type === 'time') {
        const name = getFieldDisplayName(field, frame, input);
        timeFields.push({ label: name, value: name });
      }
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
        <InlineField
          label={t('transformers.format-time-transfomer-editor.label-time-field', 'Time field')}
          labelWidth={15}
          grow
        >
          <Select
            options={timeFields}
            value={options.timeField}
            onChange={onSelectField}
            /* don't translate here as this references a field name */
            /* eslint-disable-next-line @grafana/no-untranslated-strings */
            placeholder="time"
            isClearable
          />
        </InlineField>

        <InlineField
          label={t('transformers.format-time-transfomer-editor.label-format', 'Format')}
          labelWidth={10}
          tooltip={
            <Trans i18nKey="transformers.format-time-transfomer-editor.tooltip-format">
              The output format for the field specified as a{' '}
              <TextLink href="https://momentjs.com/docs/#/displaying/" external>
                Moment.js format string
              </TextLink>
              .
            </Trans>
          }
          interactive={true}
        >
          <Input onChange={onFormatChange} value={options.outputFormat} />
        </InlineField>
        <InlineField
          label={t('transformers.format-time-transfomer-editor.label-set-timezone', 'Set timezone')}
          tooltip={t(
            'transformers.format-time-transfomer-editor.tooltip-timezone-manually',
            'Set the timezone of the date manually'
          )}
          labelWidth={20}
        >
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
  help: getTransformationContent(DataTransformerID.formatTime).helperDocs,
};
