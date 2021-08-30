import React, { FC, useCallback } from 'react';
import {
  FieldNamePickerConfigSettings,
  StandardEditorProps,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
} from '@grafana/data';
import { TextDimensionConfig, TextDimensionMode, TextDimensionOptions } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, StringValueEditor } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';

const textOptions = [
  { label: 'Fixed', value: TextDimensionMode.Fixed, description: 'Fixed value' },
  { label: 'Field', value: TextDimensionMode.Field, description: 'Display field value' },
  { label: 'Template', value: TextDimensionMode.Template, description: 'use template text' },
];

const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as any;

const dummyStringSettings: StandardEditorsRegistryItem<string, StringFieldConfigSettings> = {
  settings: {},
} as any;

export const TextDimensionEditor: FC<StandardEditorProps<TextDimensionConfig, TextDimensionOptions, any>> = (props) => {
  const { value, context, onChange } = props;
  const labelWidth = 9;

  const onModeChange = useCallback(
    (mode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onFieldChange = useCallback(
    (field) => {
      onChange({
        ...value,
        field,
      });
    },
    [onChange, value]
  );

  const onFixedChange = useCallback(
    (fixed) => {
      onChange({
        ...value,
        fixed,
      });
    },
    [onChange, value]
  );

  const mode = value?.mode ?? TextDimensionMode.Fixed;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Source" labelWidth={labelWidth} grow={true}>
          <RadioButtonGroup value={mode} options={textOptions} onChange={onModeChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {mode !== TextDimensionMode.Fixed && (
        <InlineFieldRow>
          <InlineField label="Field" labelWidth={labelWidth} grow={true}>
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
        <InlineFieldRow>
          <InlineField label={'Value'} labelWidth={labelWidth} grow={true}>
            <StringValueEditor
              context={context}
              value={value?.fixed}
              onChange={onFixedChange}
              item={dummyStringSettings}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {mode === TextDimensionMode.Template && (
        <InlineFieldRow>
          <InlineField label="Template" labelWidth={labelWidth} grow={true}>
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
