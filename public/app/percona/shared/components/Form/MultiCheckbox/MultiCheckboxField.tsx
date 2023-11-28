/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { ChangeEvent, FC, FocusEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Field, FieldInputProps } from 'react-final-form';

import { useStyles } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Label } from '../Label';

import { getStyles } from './MultiCheckboxField.styles';
import { MultiCheckboxFieldProps, MultiCheckboxRenderProps } from './MultiCheckboxField.types';

const { compose } = validators;

export const MultiCheckboxField: FC<React.PropsWithChildren<MultiCheckboxFieldProps>> = React.memo(
  ({
    className,
    disabled = false,
    label,
    name,
    required = false,
    showErrorOnBlur = false,
    initialOptions,
    validators,
    recommendedOptions = [],
    recommendedLabel,
    ...fieldConfig
  }) => {
    const styles = useStyles(getStyles);
    const [selectedOptions, setSelectedOptions] = useState(initialOptions);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    const onChangeOption = useCallback(
      (input: FieldInputProps<string, HTMLElement>) =>
        ({ target }: ChangeEvent<HTMLInputElement>) => {
          const newSelectedOptions = selectedOptions.map((option) =>
            option.name === target.name ? { ...option, value: target.checked } : option
          );

          input.onChange(newSelectedOptions);
          setSelectedOptions(newSelectedOptions);
        },
      [selectedOptions]
    );
    const onBlurOption = useCallback(
      (input: FieldInputProps<string, HTMLElement>) => (event: FocusEvent<HTMLElement>) => input.onBlur(event),
      []
    );

    useEffect(() => setSelectedOptions(initialOptions), [initialOptions]);

    return (
      <Field {...fieldConfig} name={name} initialValue={selectedOptions as any} validate={validate}>
        {({ input, meta }: MultiCheckboxRenderProps) => {
          const validationError = meta.error && typeof meta.error === 'string' ? meta.error : undefined;

          return (
            <div className={styles.field} data-testid={`${name}-field-container`}>
              {label && <Label label={`${label}${required ? ' *' : ''}`} dataTestId={`${name}-field-label`} />}
              <div
                className={cx(styles.getOptionsWrapperStyles(!!validationError), className)}
                data-testid={`${name}-options`}
              >
                {selectedOptions.map(({ name, label, value }) => (
                  <div className={styles.optionWrapper} key={name} data-testid={`${name}-option`}>
                    <span className={styles.optionLabel}>{label}</span>
                    {recommendedOptions.some((r) => r.name === name) && (
                      <span className={styles.recommendedLabel}>{recommendedLabel}</span>
                    )}
                    <CheckboxField
                      name={name}
                      inputProps={{
                        checked: value,
                        onChange: onChangeOption(input),
                        onBlur: onBlurOption(input),
                      }}
                    />
                  </div>
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
);

MultiCheckboxField.displayName = 'MultiCheckboxField';
