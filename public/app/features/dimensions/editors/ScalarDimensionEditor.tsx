import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { FieldType, GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScalarDimensionMode, ScalarDimensionConfig } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { ScalarDimensionOptions } from '../types';

type Props = StandardEditorProps<ScalarDimensionConfig, ScalarDimensionOptions>;

export const ScalarDimensionEditor = ({ value, context, onChange, item }: Props) => {
  const { settings } = item;

  const fixedValueOption: SelectableValue<string> = useMemo(
    () => ({
      label: t('dimensions.scalar-dimension-editor.fixed-value-options.label-fixed-values', 'Fixed value'),
      value: '_____fixed_____',
    }),
    []
  );

  const scalarOptions = [
    {
      label: t('dimensions.scalar-dimension-editor.scalar-options.label-mod', 'Mod'),
      value: ScalarDimensionMode.Mod,
      description: t(
        'dimensions.scalar-dimension-editor.scalar-options.description-mod',
        'Use field values, mod from max'
      ),
    },
    {
      label: t('dimensions.scalar-dimension-editor.scalar-options.label-clamped', 'Clamped'),
      value: ScalarDimensionMode.Clamped,
      description: t(
        'dimensions.scalar-dimension-editor.scalar-options.description-clamped',
        'Use field values, clamped to max and min'
      ),
    },
  ];

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
    [onChange, value, fixedValueOption.value]
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

  const valueInputId = useId();

  const val = value ?? {};
  const mode = value?.mode ?? ScalarDimensionMode.Mod;
  const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <div>
        <InlineFieldRow>
          <InlineField label={t('dimensions.scalar-dimension-editor.label-limit', 'Limit')} labelWidth={8} grow={true}>
            <RadioButtonGroup value={mode} options={scalarOptions} onChange={onModeChange} fullWidth />
          </InlineField>
        </InlineFieldRow>
        <Select
          value={selectedOption}
          options={selectOptions}
          onChange={onSelectChange}
          noOptionsMessage={t('dimensions.scalar-dimension-editor.noOptionsMessage-no-fields-found', 'No fields found')}
        />
      </div>
      <div className={styles.range}>
        {isFixed && (
          <InlineFieldRow>
            <InlineField
              label={t('dimensions.scalar-dimension-editor.label-value', 'Value')}
              labelWidth={8}
              grow={true}
            >
              <NumberInput
                id={valueInputId}
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
  range: css({
    paddingTop: theme.spacing(1),
  }),
});
