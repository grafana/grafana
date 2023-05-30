import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ScaleDimensionConfig } from '@grafana/schema';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { validateScaleOptions, validateScaleConfig } from '../scale';
import { ScaleDimensionOptions } from '../types';

const fixedValueOption: SelectableValue<string> = {
  label: 'Fixed value',
  value: '_____fixed_____',
};

export const ScaleDimensionEditor = (props: StandardEditorProps<ScaleDimensionConfig, ScaleDimensionOptions>) => {
  const { value, context, onChange, item } = props;
  const { settings } = item;
  const styles = useStyles2(getStyles);

  const fieldName = value?.field;
  const isFixed = Boolean(!fieldName);
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, fieldName, fixedValueOption);
  const minMaxStep = useMemo(() => {
    return validateScaleOptions(settings);
  }, [settings]);

  // Validate and update
  const validateAndDoChange = useCallback(
    (v: ScaleDimensionConfig) => {
      // always called with a copy so no need to spread
      onChange(validateScaleConfig(v, minMaxStep));
    },
    [onChange, minMaxStep]
  );

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      const field = selection.value;
      if (field && field !== fixedValueOption.value) {
        validateAndDoChange({
          ...value,
          field,
        });
      } else {
        validateAndDoChange({
          ...value,
          field: undefined,
        });
      }
    },
    [validateAndDoChange, value]
  );

  const onMinChange = useCallback(
    (min?: number) => {
      if (min !== undefined) {
        validateAndDoChange({
          ...value,
          min,
        });
      }
    },
    [validateAndDoChange, value]
  );

  const onMaxChange = useCallback(
    (max?: number) => {
      if (max !== undefined) {
        validateAndDoChange({
          ...value,
          max,
        });
      }
    },
    [validateAndDoChange, value]
  );

  const onValueChange = useCallback(
    (fixed?: number) => {
      if (fixed !== undefined) {
        validateAndDoChange({
          ...value,
          fixed,
        });
      }
    },
    [validateAndDoChange, value]
  );

  const val = value ?? {};
  const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <div>
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
              <NumberInput value={val.fixed} {...minMaxStep} onChange={onValueChange} />
            </InlineField>
          </InlineFieldRow>
        )}
        {!isFixed && !minMaxStep.hideRange && (
          <>
            <InlineFieldRow>
              <InlineField label="Min" labelWidth={8} grow={true}>
                <NumberInput value={val.min} {...minMaxStep} onChange={onMinChange} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Max" labelWidth={8} grow={true}>
                <NumberInput value={val.max} {...minMaxStep} onChange={onMaxChange} />
              </InlineField>
            </InlineFieldRow>
          </>
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
