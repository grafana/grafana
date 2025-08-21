import { useCallback } from 'react';

import {
  FieldNamePickerConfigSettings,
  SelectableValue,
  StandardEditorProps,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { DirectionDimensionMode, DirectionDimensionConfig, ConnectionDirection } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import { DirectionDimensionOptions } from '../types';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const dummyFieldSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

type Props = StandardEditorProps<DirectionDimensionConfig, DirectionDimensionOptions>;

export const DirectionDimensionEditor = ({ value, context, onChange }: Props) => {
  const directionOptions = [
    {
      label: t('dimensions.direction-dimension-editor.label-fixed', 'Fixed'),
      value: DirectionDimensionMode.Fixed,
      description: t('dimensions.direction-dimension-editor.description-fixed', 'Fixed direction value'),
    },
    {
      label: t('dimensions.direction-dimension-editor.label-field', 'Field'),
      value: DirectionDimensionMode.Field,
      description: t('dimensions.direction-dimension-editor.description-field', 'Direction based on field value'),
    },
  ];

  const fixedDirectionOptions: Array<SelectableValue<ConnectionDirection>> = [
    { value: ConnectionDirection.Forward, label: t('canvas.connection.direction-options.label-forward', 'Forward') },
    { value: ConnectionDirection.Reverse, label: t('canvas.connection.direction-options.label-reverse', 'Reverse') },
    { value: ConnectionDirection.Both, label: t('canvas.connection.direction-options.label-both', 'Both') },
    { value: ConnectionDirection.None, label: t('canvas.connection.direction-options.label-none', 'None') },
  ];

  const labelWidth = 9;

  const onModeChange = useCallback(
    (mode: DirectionDimensionMode) => {
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
    (selection: SelectableValue<ConnectionDirection>) => {
      onChange({
        ...value,
        field: undefined,
        fixed: selection.value ?? ConnectionDirection.Forward,
      });
    },
    [onChange, value]
  );

  const mode = value?.mode ?? DirectionDimensionMode.Fixed;
  const selectedDirection = fixedDirectionOptions.find((opt) => opt.value === value?.fixed) || fixedDirectionOptions[0];

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('dimensions.direction-dimension-editor.label-source', 'Source')}
          labelWidth={labelWidth}
          grow={true}
        >
          <RadioButtonGroup value={mode} options={directionOptions} onChange={onModeChange} fullWidth />
        </InlineField>
      </InlineFieldRow>

      {mode === DirectionDimensionMode.Field && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.direction-dimension-editor.label-field', 'Field')}
            labelWidth={labelWidth}
            grow={true}
          >
            <FieldNamePicker
              context={context}
              value={value?.field ?? ''}
              onChange={onFieldChange}
              item={dummyFieldSettings}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {mode === DirectionDimensionMode.Fixed && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.direction-dimension-editor.label-direction', 'Direction')}
            labelWidth={labelWidth}
            grow={true}
          >
            <Select value={selectedDirection} options={fixedDirectionOptions} onChange={onFixedChange} />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
