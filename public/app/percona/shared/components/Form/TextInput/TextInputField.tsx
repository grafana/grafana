import { cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';
import { Field, FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

import { Button, Icon, IconName, useStyles2 } from '@grafana/ui';
import { compose, Validator } from 'app/percona/shared/helpers/validatorsForm';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';
import { LabelCore } from '../LabelCore';

import { getStyles } from './TextInput.styles';

/**
 * Note: the validation error message will be displayed once the the input has been modified.
 * To show the error message on blur you have to pass `showErrorOnBlur`.
 */
export interface TextInputFieldProps extends UseFieldConfig<string>, LabeledFieldProps {
  className?: string;
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldInputAttrs;
  placeholder?: string;
  showErrorOnBlur?: boolean;
  showErrorOnRender?: boolean;
  validators?: Validator[];
  placeholderIcon?: IconName;
  clearable?: boolean;
}

interface TextFieldRenderProps {
  input: FieldInputProps<string>;
  meta: FieldMetaState<string>;
}

export const TextInputField: FC<TextInputFieldProps> = React.memo(
  ({
    className,
    disabled = false,
    fieldClassName,
    inputProps,
    label,
    name,
    inputId = `input-${name}-id`,
    placeholder,
    required = false,
    showErrorOnBlur = false,
    showErrorOnRender = false,
    validators,
    tooltipText = '',
    tooltipLink,
    tooltipLinkText,
    tooltipIcon,
    tooltipDataTestId,
    tooltipLinkTarget,
    tooltipInteractive,
    placeholderIcon,
    clearable,
    ...fieldConfig
  }) => {
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

    return (
      <Field {...fieldConfig} type="text" name={name} validate={validate}>
        {({ input, meta }: TextFieldRenderProps) => {
          const validationError =
            (((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error) || (showErrorOnRender && meta.error);

          return (
            <div className={cx(styles.field, fieldClassName)} data-testid={`${name}-field-container`}>
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
                tooltipInteractive={tooltipInteractive}
              />
              <div className={styles.inputContainer}>
                {!!placeholderIcon && (
                  <div className={styles.iconContainer}>
                    <Icon className={styles.icon} name={placeholderIcon} />
                  </div>
                )}
                <input
                  id={inputId}
                  {...input}
                  {...inputProps}
                  disabled={disabled}
                  placeholder={placeholder}
                  data-testid={`${name}-text-input`}
                  className={cx(
                    styles.input,
                    !!placeholderIcon && styles.inputWithIcon,
                    clearable && styles.inputClearable,
                    { invalid: !!validationError },
                    className
                  )}
                />
                {clearable && !!input.value && (
                  <div className={styles.clearContainer}>
                    <Button fill="text" type="button" onClick={() => input.onChange('')} size="xs">
                      Clear
                    </Button>
                  </div>
                )}
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
);

TextInputField.displayName = 'TextInputField';
