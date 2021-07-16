import React, { FC, useCallback, useMemo } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ScaleDimensionConfig, ScaleDimensionOptions } from '../types';
import { Select, useStyles2 } from '@grafana/ui';
import {
  useFieldDisplayNames,
  useSelectOptions,
} from '../../../../../../../packages/grafana-ui/src/components/MatchersUI/utils';
import { NumberInput } from '../../components/NumberInput';
import { css } from '@emotion/css';
import { validateScaleOptions, validateScaleConfig } from '../scale';

const fixedValueOption: SelectableValue<string> = {
  label: 'Fixed value',
  value: '_____fixed_____',
};

export const ScaleDimensionEditor: FC<StandardEditorProps<ScaleDimensionConfig, ScaleDimensionOptions, any>> = (
  props
) => {
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
    (min: number) => {
      validateAndDoChange({
        ...value,
        min,
      });
    },
    [validateAndDoChange, value]
  );

  const onMaxChange = useCallback(
    (max: number) => {
      validateAndDoChange({
        ...value,
        max,
      });
    },
    [validateAndDoChange, value]
  );

  const onValueChange = useCallback(
    (fixed: number) => {
      validateAndDoChange({
        ...value,
        fixed,
      });
    },
    [validateAndDoChange, value]
  );

  const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <Select
        value={selectedOption}
        options={selectOptions}
        onChange={onSelectChange}
        noOptionsMessage="No fields found"
      />
      {isFixed ? (
        <div>
          <NumberInput value={value.fixed} {...minMaxStep} onChange={onValueChange} />
        </div>
      ) : (
        <div>
          <table className={styles.table}>
            <tbody>
              <tr>
                <th className={styles.half}>Min</th>
                <th className={styles.half}>Max</th>
              </tr>
              <tr>
                <td>
                  <NumberInput value={value.min} {...minMaxStep} onChange={onMinChange} />
                </td>
                <td>
                  <NumberInput value={value.max} {...minMaxStep} onChange={onMaxChange} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;
    margin-top: 8px;
  `,
  half: css`
    width: 50%;
  `,
});
