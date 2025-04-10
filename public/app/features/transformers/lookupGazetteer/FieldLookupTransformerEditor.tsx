import { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  PluginState,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
  FieldType,
  TransformerCategory,
} from '@grafana/data';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { t } from 'app/core/internationalization';
import { GazetteerPathEditor, GazetteerPathEditorConfigSettings } from 'app/features/geo/editor/GazetteerPathEditor';

import { getTransformationContent } from '../docs/getTransformationContent';

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

const fieldLookupSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, GazetteerPathEditorConfigSettings>;

export const FieldLookupTransformerEditor = ({ input, options, onChange }: TransformerUIProps<FieldLookupOptions>) => {
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
        <InlineField label={t('transformers.field-lookup-transformer-editor.label-field', 'Field')} labelWidth={12}>
          <FieldNamePicker
            context={{ data: input }}
            value={options?.lookupField ?? ''}
            onChange={onPickLookupField}
            item={fieldNamePickerSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={t('transformers.field-lookup-transformer-editor.label-lookup', 'Lookup')} labelWidth={12}>
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
  name: fieldLookupTransformer.name,
  description: `Use a field value to lookup additional fields from an external source. This currently supports spatial data, but will eventually support more formats.`,
  state: PluginState.alpha,
  categories: new Set([TransformerCategory.PerformSpatialOperations]),
  help: getTransformationContent(DataTransformerID.fieldLookup).helperDocs,
};
