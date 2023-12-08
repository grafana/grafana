import { cx } from '@emotion/css';
import React, { FC, useCallback, useMemo, useRef } from 'react';
import { Field, FieldInputProps, FieldMetaState, UseFieldConfig } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';
import { compose, Validator } from '../../../helpers/validatorsForm';
import { LabelCore } from '../LabelCore';

import { getStyles } from './NumberInput.styles';

export interface NumberInputFieldProps extends UseFieldConfig<number>, LabeledFieldProps {
  className?: string;
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldInputAttrs;
  placeholder?: string;
  showErrorOnBlur?: boolean;
  showErrorOnRender?: boolean;
  validators?: Validator[];
}

interface NumberFieldRenderProps {
  input: FieldInputProps<number>;
  meta: FieldMetaState<number>;
}

export const NumberInputField: FC<NumberInputFieldProps> = React.memo(
  ({
    className,
    disabled = false,
    fieldClassName,
    inputProps,
    label,
    name,
    placeholder,
    required = false,
    showErrorOnBlur = false,
    showErrorOnRender = false,
    validators,
    inputId = `input-${name}-id`,
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

    const inputRef = useRef<HTMLInputElement>(null);

    const dispatchChangeEvent = useCallback(() => {
      const event = new Event('change', { bubbles: true });

      if (inputRef.current) {
        inputRef.current.dispatchEvent(event);
      }
    }, [inputRef]);

    const stepUp = useCallback(() => {
      if (inputRef.current) {
        inputRef.current.stepUp();
      }

      dispatchChangeEvent();
    }, [inputRef, dispatchChangeEvent]);

    const stepDown = useCallback(() => {
      if (inputRef.current) {
        inputRef.current.stepDown();
      }

      dispatchChangeEvent();
    }, [inputRef, dispatchChangeEvent]);

    return (
      <Field {...fieldConfig} type="number" name={name} validate={validate}>
        {({ input, meta }: NumberFieldRenderProps) => {
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
              <span className={styles.inputWrapper}>
                <input
                  id={inputId}
                  {...input}
                  {...inputProps}
                  ref={inputRef}
                  disabled={disabled}
                  placeholder={placeholder}
                  data-testid={`${name}-number-input`}
                  className={cx(styles.input, { invalid: !!validationError }, className)}
                />
                {!disabled && (
                  <>
                    <button type="button" className={styles.buttonUp} onClick={stepUp}>
                      <span className={styles.arrowUp} />
                    </button>
                    <button type="button" className={styles.buttonDown} onClick={stepDown}>
                      <span className={styles.arrowDown} />
                    </button>
                  </>
                )}
              </span>
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

NumberInputField.displayName = 'NumberInputField';
