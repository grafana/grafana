import React, { useCallback } from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { GazetteerPathEditor } from 'app/plugins/panel/geomap/editor/GazetteerPathEditor';
import { GazetteerPathEditorConfigSettings } from 'app/plugins/panel/geomap/types';
import { FieldLookupOptions, fieldLookupTransformer } from './fieldLookup';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24 },
} as any;

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
    <InlineFieldRow>
      <InlineField label={'Gazetteer'}>
        <GazetteerPathEditor
          value={options?.gazetteer ?? ''}
          context={{ data: input }}
          item={fieldLookupSettings}
          onChange={onPickGazetteer}
        />
      </InlineField>
      <InlineField label={'lookup field'}>
        <FieldNamePicker
          context={{ data: input }}
          value={options?.lookupField ?? ''}
          onChange={onPickLookupField}
          item={fieldNamePickerSettings}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export const fieldLookupTransformRegistryItem: TransformerRegistryItem<FieldLookupOptions> = {
  id: DataTransformerID.fieldLookup,
  editor: FieldLookupTransformerEditor,
  transformation: fieldLookupTransformer,
  name: 'Field lookup',
  description: `Looks up matching data from resource based on selected field`,
};
