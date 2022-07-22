import React, { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  PluginState,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
  FieldType,
} from '@grafana/data';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { GazetteerPathEditor, GazetteerPathEditorConfigSettings } from 'app/features/geo/editor/GazetteerPathEditor';

import { FieldLookupOptions, fieldLookupTransformer } from './fieldLookup';

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

const fieldLookupSettings: StandardEditorsRegistryItem<string, GazetteerPathEditorConfigSettings> = {
  settings: {},
} as any;

export const FieldLookupTransformerEditor: React.FC<TransformerUIProps<FieldLookupOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const onPickLookupField = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        lookupField: value,
      });
    },
    [onChange, options]
  );

  const onPickGazetteer = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        gazetteer: value,
      });
    },
    [onChange, options]
  );
  return (
    <div>
      <InlineFieldRow>
        <InlineField label={'Field'} labelWidth={12}>
          <FieldNamePicker
            context={{ data: input }}
            value={options?.lookupField ?? ''}
            onChange={onPickLookupField}
            item={fieldNamePickerSettings as any}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Lookup'} labelWidth={12}>
          <GazetteerPathEditor
            value={options?.gazetteer ?? ''}
            context={{ data: input }}
            item={fieldLookupSettings}
            onChange={onPickGazetteer}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};

export const fieldLookupTransformRegistryItem: TransformerRegistryItem<FieldLookupOptions> = {
  id: DataTransformerID.fieldLookup,
  editor: FieldLookupTransformerEditor,
  transformation: fieldLookupTransformer,
  name: 'Field lookup',
  description: `Use a field value to lookup additional fields from an external source.  This currently supports spatial data, but will eventually support more formats`,
  state: PluginState.alpha,
};
