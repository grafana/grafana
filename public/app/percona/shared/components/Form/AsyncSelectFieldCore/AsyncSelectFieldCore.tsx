/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';
import { Field, FieldInputProps, UseFieldConfig } from 'react-final-form';

import { SelectableValue } from '@grafana/data';
import { ActionMeta, AsyncSelect, SelectAsyncProps, SelectCommonProps, useStyles2 } from '@grafana/ui';
import { compose, GetSelectValueFunction, Validator } from 'app/percona/shared/helpers/validatorsForm';

import { LabeledFieldProps } from '../../../helpers/types';
import { LabelCore } from '../LabelCore';

import { getStyles } from './AsyncSelectFieldCore.styles';

interface AsyncSelectProps<T> extends Omit<SelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  value?: SelectableValue<T> | null;
  invalid?: boolean;
}

export interface AsyncSelectFieldProps<T>
  extends Omit<UseFieldConfig<T>, 'defaultValue' | 'value'>,
    LabeledFieldProps,
    Omit<AsyncSelectProps<T>, 'onChange'> {
  className?: string;
  validators?: Validator[];
  fieldClassName?: string;
  showErrorOnBlur?: boolean;
  onChange?: (value: SelectableValue<T>, actionMeta: ActionMeta) => {} | void;
  onChangeGenerator?: (
    input: FieldInputProps<any, HTMLElement>
  ) => (value: SelectableValue<T>, actionMeta: ActionMeta) => {} | void;
  getValueForValidators?: GetSelectValueFunction<SelectableValue<T> | null>;
}

export const AsyncSelectFieldCore: FC<AsyncSelectFieldProps<any>> = ({
  label,
  name,
  required,
  inputId,
  tooltipLink,
  tooltipText,
  tooltipLinkText,
  tooltipDataTestId,
  tooltipIcon,
  tooltipLinkTarget,
  validators,
  fieldClassName,
  className,
  showErrorOnBlur,
  onChange,
  onChangeGenerator,
  getValueForValidators,
  ...fieldConfig
}) => {
  const styles = useStyles2(getStyles);

  const getValue = useMemo(
    () => getValueForValidators || ((incomingValue: any) => incomingValue?.value),
    [getValueForValidators]
  );
  const validate = useMemo(
    () => (Array.isArray(validators) ? compose(validators, getValue) : undefined),
    [validators, getValue]
  );

  return (
    <Field {...fieldConfig} name={name} validate={validate}>
      {({ input, meta }) => {
        const validationError = ((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error;

        return (
          <div className={cx(styles.field, fieldClassName)} data-testid={`${name}-field-container`}>
            {!!label && (
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
            )}
            <AsyncSelect
              {...fieldConfig}
              className={cx({ invalid: !!validationError }, className)}
              {...input}
              onChange={(value, actionMeta) => {
                if (onChangeGenerator) {
                  onChangeGenerator(input);
                } else if (onChange) {
                  onChange(value, actionMeta);
                }

                input.onChange(value);
              }}
            />
            <div data-testid={`${name}-field-error-message`} className={styles.errorMessage}>
              {validationError}
            </div>
          </div>
        );
      }}
    </Field>
  );
};
