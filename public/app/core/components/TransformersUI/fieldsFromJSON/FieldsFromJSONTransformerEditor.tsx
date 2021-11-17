import React from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  PluginState,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { FieldsFromJSONOptions, fieldsFromJSONTransformer } from './fieldsFromJSON';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

// const fieldsFromJSONSettings: StandardEditorsRegistryItem<string, GazetteerPathEditorConfigSettings> = {
//   settings: {},
// } as any;

export const fieldsFromJSONTransformerEditor: React.FC<TransformerUIProps<FieldsFromJSONOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const onPickLookupField = (field: string | undefined) => {
    onChange({
      ...options,
      field: field!,
    });
  };

  const onToggleReplace = () => {
    onChange({
      ...options,
      replace: !options.replace,
    });
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField label={'JSON Field'} labelWidth={16}>
          <FieldNamePicker
            context={{ data: input }}
            value={options?.field ?? ''}
            onChange={onPickLookupField}
            item={fieldNamePickerSettings as any}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Replace all fields'} labelWidth={16}>
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};

export const fieldsFromJSONTransformRegistryItem: TransformerRegistryItem<FieldsFromJSONOptions> = {
  id: DataTransformerID.fieldsFromJSON,
  editor: fieldsFromJSONTransformerEditor,
  transformation: fieldsFromJSONTransformer,
  name: 'Fields from JSON',
  description: `Parse values from JSON strings`,
  state: PluginState.alpha,
};
