import { ChangeEvent } from 'react';

import {
  DataTransformerID,
  TransformerRegistryItem,
  TransformerUIProps,
  FieldNamePickerConfigSettings,
  SelectableValue,
  StandardEditorsRegistryItem,
  TransformerCategory,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Select, InlineSwitch, Input, Combobox, ComboboxOption } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/extractFields.svg';
import lightImage from '../images/light/extractFields.svg';

import { JSONPathEditor } from './components/JSONPathEditor';
import { extractFieldsTransformer } from './extractFields';
import { fieldExtractors } from './fieldExtractors';
import { ExtractFieldsOptions, FieldExtractorID, JSONPath } from './types';

export const extractFieldsTransformerEditor = ({
  input,
  options = { delimiter: ',' },
  onChange,
}: TransformerUIProps<ExtractFieldsOptions>) => {
  const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
    settings: {
      width: 30,
      placeholderText: t(
        'transformers.extract-fields-transformer-editor.field-name-picker-settings.placeholderText.select-field',
        'Select field'
      ),
    },
    name: '',
    id: '',
    editor: () => null,
  };

  const onPickSourceField = (source?: string) => {
    onChange({
      ...options,
      source,
    });
  };

  const onFormatChange = (format?: SelectableValue<FieldExtractorID>) => {
    onChange({
      ...options,
      format: format?.value,
    });
  };

  const onJSONPathsChange = (jsonPaths: JSONPath[]) => {
    onChange({
      ...options,
      jsonPaths,
    });
  };

  const onRegexpChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      regExp: e.target.value,
    });
  };

  const onDelimiterChange = (val: ComboboxOption) => {
    onChange({
      ...options,
      delimiter: val.value,
    });
  };

  const onToggleReplace = () => {
    if (options.replace) {
      options.keepTime = false;
    }

    onChange({
      ...options,
      replace: !options.replace,
    });
  };

  const onToggleKeepTime = () => {
    onChange({
      ...options,
      keepTime: !options.keepTime,
    });
  };

  const format = fieldExtractors.selectOptions(options.format ? [options.format] : undefined);

  return (
    <div>
      <InlineFieldRow>
        <InlineField label={t('transformers.extract-fields-transformer-editor.label-source', 'Source')} labelWidth={16}>
          <FieldNamePicker
            context={{ data: input }}
            value={options.source ?? ''}
            onChange={onPickSourceField}
            item={fieldNamePickerSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={t('transformers.extract-fields-transformer-editor.label-format', 'Format')} labelWidth={16}>
          <Select
            value={format.current[0] as any}
            options={format.options as any}
            onChange={onFormatChange}
            width={24}
            placeholder={t('transformers.extract-fields-transformer-editor.placeholder-auto', 'Auto')}
          />
        </InlineField>
      </InlineFieldRow>
      {options.format === FieldExtractorID.RegExp && (
        <InlineFieldRow>
          <InlineField
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            label="RegExp"
            labelWidth={16}
            interactive={true}
            tooltip={t('transformers.extract-fields-transformer-editor.tooltip-regexp', 'Example: {{regexExample}}', {
              regexExample: '/(?<NewField>.*)/',
              interpolation: { escapeValue: false },
            })}
          >
            <Input
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="/(?<NewField>.*)/"
              value={options.regExp}
              onChange={onRegexpChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {options.format === FieldExtractorID.JSON && (
        <JSONPathEditor options={options.jsonPaths ?? []} onChange={onJSONPathsChange} />
      )}
      {options.format === FieldExtractorID.Delimiter && (
        <InlineFieldRow>
          <InlineField
            label={t('transformers.extract-fields-transformer-editor.label-delimiter', 'Delimiter')}
            labelWidth={16}
          >
            <Combobox
              value={options.delimiter}
              options={[{ value: ',' }, { value: ';' }, { value: '|' }]}
              onChange={onDelimiterChange}
              placeholder={t(
                'transformers.extract-fields-transformer-editor.placeholder-select-delimiter',
                'Select delimiter...'
              )}
              width={24}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      <InlineFieldRow>
        <InlineField
          label={t('transformers.extract-fields-transformer-editor.label-replace-all-fields', 'Replace all fields')}
          labelWidth={16}
        >
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
      {options.replace && (
        <InlineFieldRow>
          <InlineField
            label={t('transformers.extract-fields-transformer-editor.label-keep-time', 'Keep time')}
            labelWidth={16}
          >
            <InlineSwitch value={options.keepTime ?? false} onChange={onToggleKeepTime} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const getExtractFieldsTransformRegistryItem: () => TransformerRegistryItem<ExtractFieldsOptions> = () => ({
  id: DataTransformerID.extractFields,
  editor: extractFieldsTransformerEditor,
  transformation: extractFieldsTransformer,
  name: t('transformers.extract-fields-transformer-editor.name.extract-fields', 'Extract fields'),
  description: t(
    'transformers.extract-fields-transformer-editor.description.parse-fields-from-content',
    'Parse fields from content (JSON, labels, etc).'
  ),
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.extractFields).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
