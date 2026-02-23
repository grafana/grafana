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
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { GazetteerPathEditor, GazetteerPathEditorConfigSettings } from 'app/features/geo/editor/GazetteerPathEditor';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/fieldLookup.svg';
import lightImage from '../images/light/fieldLookup.svg';

import { FieldLookupOptions, fieldLookupTransformer } from './fieldLookup';

const fieldLookupSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, GazetteerPathEditorConfigSettings>;

export const FieldLookupTransformerEditor = ({ input, options, onChange }: TransformerUIProps<FieldLookupOptions>) => {
  const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
    settings: {
      width: 30,
      filter: (f) => f.type === FieldType.string,
      placeholderText: t(
        'transformers.field-lookup-transformer-editor.field-name-picker-settings.placeholderText.select-text-field',
        'Select text field'
      ),
      noFieldsMessage: t(
        'transformers.field-lookup-transformer-editor.field-name-picker-settings.noFieldsMessage.no-text-fields-found',
        'No text fields found'
      ),
    },
    name: '',
    id: '',
    editor: () => null,
  };

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

export const getFieldLookupTransformRegistryItem: () => TransformerRegistryItem<FieldLookupOptions> = () => ({
  id: DataTransformerID.fieldLookup,
  editor: FieldLookupTransformerEditor,
  transformation: fieldLookupTransformer,
  name: t(
    'transformers.field-lookup-transformer-editor.name.lookup-fields-from-resource',
    'Lookup fields from resource'
  ),
  description: t(
    'transformers.field-lookup-transformer-editor.description.lookup-additional-fields-external-source',
    'Use a field value to lookup countries, states, or airports.'
  ),
  state: PluginState.alpha,
  categories: new Set([TransformerCategory.PerformSpatialOperations]),
  help: getTransformationContent(DataTransformerID.fieldLookup).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
