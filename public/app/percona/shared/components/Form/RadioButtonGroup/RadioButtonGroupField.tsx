/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { Field, FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

import { SelectableValue } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';
import { compose, Validator } from 'app/percona/shared/helpers/validatorsForm';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';
import { LabelCore } from '../LabelCore';

import { RadioButton, RadioButtonSize } from './RadioButton';
import { getStyles } from './RadioButtonGroup.styles';

type RadionButtonGroupOptions = Array<SelectableValue<string> & { disabled?: boolean }>;

export interface RadioButtonGroupFieldProps extends UseFieldConfig<string>, LabeledFieldProps {
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  inputProps?: FieldInputAttrs;
  options: RadionButtonGroupOptions;
  showErrorOnBlur?: boolean;
  size?: RadioButtonSize;
  validators?: Validator[];
}

interface RadioGroupFieldRenderProps {
  input: FieldInputProps<string>;
  meta: FieldMetaState<string>;
}

export function RadioButtonGroupField({
  className,
  disabled,
  fullWidth = false,
  inputProps,
  label,
  name,
  inputId = `input-${name}-id`,
  options,
  required = false,
  showErrorOnBlur = false,
  size = 'md',
  validators,
  tooltipText = '',
  tooltipLink,
  tooltipLinkText,
  tooltipIcon,
  tooltipDataTestId,
  tooltipLinkTarget,
  ...fieldConfig
}: RadioButtonGroupFieldProps) {
  const handleOnChange = useCallback(
    (option: SelectableValue<string>, input: FieldInputProps<string, HTMLElement>) => () => {
      if (option.disabled || disabled) {
        return;
      }

      input.onChange(option.value);
    },
    [disabled]
  );
  const styles = useStyles2(getStyles);
  const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

  return (
    <Field {...fieldConfig} type="text" name={name} validate={validate}>
      {({ input, meta }: RadioGroupFieldRenderProps) => {
        const validationError = ((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error;

        return (
          <div className={cx(styles.wrapper, className)}>
            <LabelCore
              name={name}
              label={label}
              required={required}
              inputId={inputId}
              tooltipLink={tooltipLink}
              tooltipLinkText={tooltipLinkText}
              tooltipText={tooltipText}
              tooltipDataTestId={tooltipDataTestId}
              tooltipLinkTarget={tooltipLinkTarget}
              tooltipIcon={tooltipIcon}
            />
            {/* this field is auxiliary, i.e. it helps address the validation, which is tricky otherwise */}
            <input id={inputId} {...input} data-testid={`${name}-radio-state`} className={styles.input} />
            <div className={styles.buttonContainer}>
              {options.map((o) => (
                <RadioButton
                  checked={input.value === o.value}
                  disabled={o.disabled || disabled}
                  fullWidth={fullWidth}
                  inputProps={inputProps}
                  key={o.label}
                  name={name}
                  onChange={handleOnChange(o, input)}
                  size={size}
                >
                  {o.icon && <Icon name={o.icon as IconName} className={styles.icon} />}
                  {o.label}
                </RadioButton>
              ))}
            </div>
            <div data-testid={`${name}-field-error-message`} className={styles.errorMessage}>
              {validationError}
            </div>
          </div>
        );
      }}
    </Field>
  );
}

RadioButtonGroupField.displayName = 'RadioButtonGroupField';
