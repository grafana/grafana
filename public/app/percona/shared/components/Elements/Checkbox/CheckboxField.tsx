import React, { FC, useMemo } from 'react';
import { Field, UseFieldConfig } from 'react-final-form';

import { compose, Validator } from 'app/percona/shared/helpers/validatorsForm';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';

import { BaseCheckbox } from './Checkbox';

export interface CheckboxProps extends UseFieldConfig<boolean>, LabeledFieldProps {
  disabled?: boolean;
  fieldClassName?: string;
  inputProps?: FieldInputAttrs;
  validators?: Validator[];
  noError?: boolean;
}

export const CheckboxField: FC<React.PropsWithChildren<CheckboxProps>> = React.memo(
  ({
    disabled,
    fieldClassName,
    inputProps,
    label,
    name,
    inputId,
    validators,
    tooltipText = '',
    tooltipLink,
    tooltipLinkText,
    tooltipIcon,
    tooltipDataTestId,
    tooltipLinkTarget,
    noError,
    ...fieldConfig
  }) => {
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

    return (
      <Field {...fieldConfig} type="checkbox" name={name} validate={validate}>
        {({ input, meta }) => (
          <BaseCheckbox
            className={fieldClassName}
            disabled={disabled}
            inputId={inputId}
            {...input}
            {...inputProps}
            name={name}
            label={label}
            tooltipLink={tooltipLink}
            tooltipLinkText={tooltipLinkText}
            tooltipText={tooltipText}
            tooltipDataTestId={tooltipDataTestId}
            tooltipLinkTarget={tooltipLinkTarget}
            tooltipIcon={tooltipIcon}
            touched={meta.touched}
            error={meta.error}
            noError={noError}
          />
        )}
      </Field>
    );
  }
);

CheckboxField.displayName = 'CheckboxField';
