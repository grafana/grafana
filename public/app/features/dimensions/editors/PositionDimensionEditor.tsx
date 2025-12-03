import { useCallback, useId, useMemo } from 'react';

import { FieldType, SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PositionDimensionConfig, PositionDimensionMode } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { PositionDimensionOptions } from '../types';

type Props = StandardEditorProps<PositionDimensionConfig, PositionDimensionOptions>;

export const PositionDimensionEditor = ({ value, context, onChange }: Props) => {
  const positionOptions = useMemo(
    () => [
      {
        label: t('dimensions.position-dimension-editor.label-fixed', 'Fixed'),
        value: PositionDimensionMode.Fixed,
        description: t('dimensions.position-dimension-editor.description-fixed', 'Fixed value'),
      },
      {
        label: t('dimensions.position-dimension-editor.label-field', 'Field'),
        value: PositionDimensionMode.Field,
        description: t('dimensions.position-dimension-editor.description-field', 'Use field value'),
      },
    ],
    []
  );

  const fixedValueOption: SelectableValue<string> = useMemo(
    () => ({
      label: t('dimensions.position-dimension-editor.fixed-value-option.label', 'Fixed value'),
      value: '_____fixed_____',
    }),
    []
  );

  const labelWidth = 9;
  const fieldName = value?.field;
  const names = useFieldDisplayNames(context.data);
  // Filter to only show number fields for position values
  const selectOptions = useSelectOptions(names, fieldName, fixedValueOption, FieldType.number);

  const onModeChange = useCallback(
    (mode: PositionDimensionMode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onFieldChange = useCallback(
    (selection: SelectableValue<string>) => {
      const field = selection.value;
      if (field && field !== fixedValueOption.value) {
        onChange({
          ...value,
          field,
        });
      } else {
        onChange({
          ...value,
          field: undefined,
        });
      }
    },
    [onChange, value, fixedValueOption.value]
  );

  const onFixedChange = useCallback(
    (fixed?: number) => {
      onChange({
        ...value,
        fixed: fixed ?? 0,
      });
    },
    [onChange, value]
  );

  const fieldInputId = useId();
  const valueInputId = useId();

  const mode = value?.mode ?? PositionDimensionMode.Fixed;
  const selectedOption =
    mode === PositionDimensionMode.Field ? selectOptions.find((v) => v.value === fieldName) : fixedValueOption;

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('dimensions.position-dimension-editor.label-source', 'Source')}
          labelWidth={labelWidth}
          grow={true}
        >
          <RadioButtonGroup value={mode} options={positionOptions} onChange={onModeChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {mode === PositionDimensionMode.Field && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.position-dimension-editor.label-field', 'Field')}
            labelWidth={labelWidth}
            grow={true}
          >
            <Select
              inputId={fieldInputId}
              value={selectedOption}
              options={selectOptions}
              onChange={onFieldChange}
              noOptionsMessage={t('dimensions.position-dimension-editor.no-fields', 'No number fields found')}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {mode === PositionDimensionMode.Fixed && (
        <InlineFieldRow>
          <InlineField
            label={t('dimensions.position-dimension-editor.label-value', 'Value')}
            labelWidth={labelWidth}
            grow={true}
          >
            <NumberInput id={valueInputId} value={value?.fixed ?? 0} onChange={onFixedChange} />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
