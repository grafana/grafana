import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScaleDimensionConfig } from '@grafana/schema';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { validateScaleOptions, validateScaleConfig } from '../scale';
import { ScaleDimensionOptions } from '../types';

export const ScaleDimensionEditor = (props: StandardEditorProps<ScaleDimensionConfig, ScaleDimensionOptions>) => {
  const { value, context, onChange, item, id } = props;
  const { settings } = item;
  const styles = useStyles2(getStyles);

  const fixedValueOption: SelectableValue<string> = useMemo(
    () => ({
      label: t('dimensions.scale-dimension-editor.fixed-value-option.label.fixed-value', 'Fixed value'),
      value: '_____fixed_____',
    }),
    []
  );

  const fieldName = value?.field;
  const isFixed = Boolean(!fieldName);
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, fieldName, fixedValueOption, settings?.filteredFieldType);
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
    [validateAndDoChange, value, fixedValueOption.value]
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

  const valueInputId = useId();
  const minInputId = useId();
  const maxInputId = useId();

  const val = value ?? {};
  const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <div>
        <Select
          inputId={id}
          value={selectedOption}
          options={selectOptions}
          onChange={onSelectChange}
          noOptionsMessage={t('dimensions.scale-dimension-editor.noOptionsMessage-no-fields-found', 'No fields found')}
        />
      </div>
      <div className={styles.range}>
        {isFixed && (
          <InlineFieldRow>
            <InlineField label={t('dimensions.scale-dimension-editor.label-value', 'Value')} labelWidth={8} grow={true}>
              <NumberInput id={valueInputId} value={val.fixed} {...minMaxStep} onChange={onValueChange} />
            </InlineField>
          </InlineFieldRow>
        )}
        {!isFixed && !minMaxStep.hideRange && (
          <>
            <InlineFieldRow>
              <InlineField label={t('dimensions.scale-dimension-editor.label-min', 'Min')} labelWidth={8} grow={true}>
                <NumberInput id={minInputId} value={val.min} {...minMaxStep} onChange={onMinChange} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label={t('dimensions.scale-dimension-editor.label-max', 'Max')} labelWidth={8} grow={true}>
                <NumberInput id={maxInputId} value={val.max} {...minMaxStep} onChange={onMaxChange} />
              </InlineField>
            </InlineFieldRow>
          </>
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
