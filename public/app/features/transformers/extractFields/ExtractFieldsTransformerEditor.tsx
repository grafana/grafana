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
import { InlineField, InlineFieldRow, Select, InlineSwitch, Input, Combobox, ComboboxOption } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { getTransformationContent } from '../docs/getTransformationContent';

import { JSONPathEditor } from './components/JSONPathEditor';
import { extractFieldsTransformer } from './extractFields';
import { fieldExtractors } from './fieldExtractors';
import { ExtractFieldsOptions, FieldExtractorID, JSONPath } from './types';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

export const extractFieldsTransformerEditor = ({
  input,
  options = { delimiter: ',' },
  onChange,
}: TransformerUIProps<ExtractFieldsOptions>) => {
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
        <InlineField label={'Source'} labelWidth={16}>
          <FieldNamePicker
            context={{ data: input }}
            value={options.source ?? ''}
            onChange={onPickSourceField}
            item={fieldNamePickerSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Format'} labelWidth={16}>
          <Select
            value={format.current[0] as any}
            options={format.options as any}
            onChange={onFormatChange}
            width={24}
            placeholder={'Auto'}
          />
        </InlineField>
      </InlineFieldRow>
      {options.format === FieldExtractorID.RegExp && (
        <InlineFieldRow>
          <InlineField label="RegExp" labelWidth={16} interactive={true} tooltip="Example: /(?<NewField>.*)/">
            <Input placeholder="/(?<NewField>.*)/" value={options.regExp} onChange={onRegexpChange} />
          </InlineField>
        </InlineFieldRow>
      )}
      {options.format === FieldExtractorID.JSON && (
        <JSONPathEditor options={options.jsonPaths ?? []} onChange={onJSONPathsChange} />
      )}
      {options.format === FieldExtractorID.Delimiter && (
        <InlineFieldRow>
          <InlineField label="Delimiter" labelWidth={16}>
            <Combobox
              value={options.delimiter}
              options={[{ value: ',' }, { value: ';' }, { value: '|' }]}
              onChange={onDelimiterChange}
              placeholder="Select delimiter..."
              width={24}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      <InlineFieldRow>
        <InlineField label={'Replace all fields'} labelWidth={16}>
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
      {options.replace && (
        <InlineFieldRow>
          <InlineField label={'Keep time'} labelWidth={16}>
            <InlineSwitch value={options.keepTime ?? false} onChange={onToggleKeepTime} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const extractFieldsTransformRegistryItem: TransformerRegistryItem<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  editor: extractFieldsTransformerEditor,
  transformation: extractFieldsTransformer,
  name: extractFieldsTransformer.name,
  description: `Parse fields from content (JSON, labels, etc).`,
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.extractFields).helperDocs,
};
