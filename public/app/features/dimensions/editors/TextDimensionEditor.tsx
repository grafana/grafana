import { useCallback } from 'react';

import {
  FieldNamePickerConfigSettings,
  StandardEditorProps,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { Button, InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';

import { TextDimensionOptions } from '../types';

const dummyFieldSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

const dummyStringSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, StringFieldConfigSettings>;

type Props = StandardEditorProps<TextDimensionConfig, TextDimensionOptions>;

export const TextDimensionEditor = ({ value, context, onChange }: Props) => {
  const textOptions = [
    {
      label: t('dimensions.text-dimension-editor.label-fixed', 'Fixed'),
      value: TextDimensionMode.Fixed,
      description: t('dimensions.text-dimension-editor.description-fixed', 'Fixed value'),
    },
    {
      label: t('dimensions.text-dimension-editor.label-field', 'Field'),
      value: TextDimensionMode.Field,
      description: t('dimensions.text-dimension-editor.description-field', 'Display field value'),
    },
    //  { label: 'Template', value: TextDimensionMode.Template, description: 'use template text' },
  ];
  const labelWidth = 9;

  const onModeChange = useCallback(
    (mode: TextDimensionMode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onFieldChange = useCallback(
    (field?: string) => {
      onChange({
        ...value,
        field,
      });
    },
    [onChange, value]
  );

  const onFixedChange = useCallback(
    (fixed = '') => {
      onChange({
        ...value,
        fixed,
      });
    },
    [onChange, value]
  );

  const onClearFixed = () => {
    onFixedChange('');
  };

  const mode = value?.mode ?? TextDimensionMode.Fixed;
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('dimensions.text-dimension-editor.label-source', 'Source')}
          labelWidth={labelWidth}
          grow={true}
        >
          <RadioButtonGroup value={mode} options={textOptions} onChange={onModeChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {mode !== TextDimensionMode.Fixed && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.text-dimension-editor.label-field', 'Field')}
            labelWidth={labelWidth}
            grow={true}
          >
            <FieldNamePicker
              context={context}
              value={value.field ?? ''}
              onChange={onFieldChange}
              item={dummyFieldSettings}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {mode === TextDimensionMode.Fixed && (
        <InlineFieldRow key={value?.fixed}>
          <InlineField
            label={t('dimensions.text-dimension-editor.label-value', 'Value')}
            labelWidth={labelWidth}
            grow={true}
          >
            <StringValueEditor
              context={context}
              value={value?.fixed}
              onChange={onFixedChange}
              item={dummyStringSettings}
              suffix={
                value?.fixed && <Button icon="times" variant="secondary" fill="text" size="sm" onClick={onClearFixed} />
              }
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {mode === TextDimensionMode.Template && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.text-dimension-editor.label-template', 'Template')}
            labelWidth={labelWidth}
            grow={true}
          >
            <StringValueEditor // This could be a code editor
              context={context}
              value={value?.fixed}
              onChange={onFixedChange}
              item={dummyStringSettings}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
