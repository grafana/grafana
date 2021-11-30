import React from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  PluginState,
  SelectableValue,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { InlineField, InlineFieldRow, InlineSwitch, Input, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ExtractFieldsOptions, extractFieldsTransformer } from './extractFields';
import { FieldExtractorID, fieldExtractors } from './fieldExtractors';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

export const extractFieldsTransformerEditor: React.FC<TransformerUIProps<ExtractFieldsOptions>> = ({
  input,
  options,
  onChange,
}) => {
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

  const onToggleReplace = () => {
    onChange({
      ...options,
      replace: !options.replace,
    });
  };

  const onToggleSingleField = () => {
    onChange({
      ...options,
      singleField: {
        ...options.singleField,
        enabled: !options.singleField.enabled,
      },
    });
  };

  const onToggleSingleFieldReplace = () => {
    onChange({
      ...options,
      singleField: {
        ...options.singleField,
        replace: !options.singleField.replace,
      },
    });
  };

  const onSingleFieldOutputChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      singleField: {
        ...options.singleField,
        output: e.currentTarget.value,
      },
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
            item={fieldNamePickerSettings as any}
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
      <InlineFieldRow>
        <InlineField label={'Replace all fields'} labelWidth={16}>
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Extract to single field'} labelWidth={24}>
          <InlineSwitch value={options.singleField.enabled ?? false} onChange={onToggleSingleField} />
        </InlineField>
        {options.singleField.enabled ? (
          <>
            <InlineField label={'Replace existing field'} labelWidth={24}>
              <InlineSwitch value={options.singleField.replace ?? false} onChange={onToggleSingleFieldReplace} />
            </InlineField>
            {options.singleField.replace ? null : (
              <InlineField label={'Output field name'} labelWidth={24}>
                <Input
                  value={options.singleField.output}
                  placeholder={options.source}
                  onChange={onSingleFieldOutputChange}
                />
              </InlineField>
            )}
          </>
        ) : null}
      </InlineFieldRow>
    </div>
  );
};

export const extractFieldsTransformRegistryItem: TransformerRegistryItem<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  editor: extractFieldsTransformerEditor,
  transformation: extractFieldsTransformer,
  name: 'Extract fields',
  description: `Parse fields from content (JSON, labels, etc)`,
  state: PluginState.alpha,
};
