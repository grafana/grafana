import { css } from '@emotion/css';
import React, { FC, useCallback } from 'react';

import { FieldType, GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { ScalarDimensionConfig, ScalarDimensionMode, ScalarDimensionOptions } from '../types';

const fixedValueOption: SelectableValue<string> = {
  label: 'Fixed value',
  value: '_____fixed_____',
};

const scalarOptions = [
  { label: 'Mod', value: ScalarDimensionMode.Mod, description: 'Use field values, mod from max' },
  { label: 'Clamped', value: ScalarDimensionMode.Clamped, description: 'Use field values, clamped to max and min' },
];

export const ScalarDimensionEditor: FC<StandardEditorProps<ScalarDimensionConfig, ScalarDimensionOptions, any>> = (
  props
) => {
  const { value, context, onChange, item } = props;
  const { settings } = item;

  const DEFAULT_VALUE = 0;

  const fieldName = value?.field;
  const isFixed = Boolean(!fieldName);
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, fieldName, fixedValueOption, FieldType.number);

  const styles = useStyles2(getStyles);

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      const field = selection.value;
      if (field && field !== fixedValueOption.value) {
        onChange({
          ...value,
          field,
        });
      } else {
        const fixed = value.fixed ?? DEFAULT_VALUE;
        onChange({
          ...value,
          field: undefined,
          fixed,
        });
      }
    },
    [onChange, value]
  );

  const onModeChange = useCallback(
    (mode: ScalarDimensionMode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onValueChange = useCallback(
    (v: number | undefined) => {
      onChange({
        ...value,
        field: undefined,
        fixed: v ?? DEFAULT_VALUE,
      });
    },
    [onChange, value]
  );

  const val = value ?? {};
  const mode = value?.mode ?? ScalarDimensionMode.Mod;
  const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <div>
        <InlineFieldRow>
          <InlineField label="Limit" labelWidth={8} grow={true}>
            <RadioButtonGroup value={mode} options={scalarOptions} onChange={onModeChange} fullWidth />
          </InlineField>
        </InlineFieldRow>
        <Select
          value={selectedOption}
          options={selectOptions}
          onChange={onSelectChange}
          noOptionsMessage="No fields found"
        />
      </div>
      <div className={styles.range}>
        {isFixed && (
          <InlineFieldRow>
            <InlineField label="Value" labelWidth={8} grow={true}>
              <NumberInput
                value={val?.fixed ?? DEFAULT_VALUE}
                onChange={onValueChange}
                max={settings?.max}
                min={settings?.min}
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  range: css`
    padding-top: 8px;
  `,
});
