import { cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';
import { Field, FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';
import { compose, Validator } from 'app/percona/shared/helpers/validatorsForm';

import { FieldTextareaAttrs, LabeledFieldProps } from '../../../helpers/types';
import { LabelCore } from '../LabelCore';

import { getStyles } from './TextareaInput.styles';

/**
 * Note: the validation error message will be displayed once the the input has been modified.
 * To show the error message on blur you have to pass `showErrorOnBlur`.
 */
export interface TextareaInputFieldProps extends UseFieldConfig<string>, LabeledFieldProps {
  className?: string;
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldTextareaAttrs;
  placeholder?: string;
  rows?: number;
  resize?: 'vertical' | 'horizontal' | 'both';
  showErrorOnBlur?: boolean;
  showErrorOnRender?: boolean;
  validators?: Validator[];
}

interface TextareaFieldRenderProps {
  input: FieldInputProps<string>;
  meta: FieldMetaState<string>;
}

export const TextareaInputField: FC<React.PropsWithChildren<TextareaInputFieldProps>> = React.memo(
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
    resize = 'vertical',
    rows = 5,
    showErrorOnBlur = false,
    showErrorOnRender = false,
    validators,
    tooltipText = '',
    tooltipLink,
    tooltipLinkText,
    tooltipIcon,
    tooltipDataTestId,
    tooltipLinkTarget,
    ...fieldConfig
  }) => {
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

    return (
      <Field {...fieldConfig} name={name} validate={validate}>
        {({ input, meta }: TextareaFieldRenderProps) => {
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
              />
              <textarea
                id={inputId}
                {...input}
                {...inputProps}
                rows={rows}
                disabled={disabled}
                placeholder={placeholder}
                data-testid={`${name}-textarea-input`}
                className={cx(styles.input, { invalid: !!validationError, [resize]: resize !== 'both' }, className)}
              />
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

TextareaInputField.displayName = 'TextareaInputField';
