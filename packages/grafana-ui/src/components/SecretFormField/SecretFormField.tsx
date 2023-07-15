import { css, cx } from '@emotion/css';
import { omit } from 'lodash';
import React, { InputHTMLAttributes } from 'react';

import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { PopoverContent } from '../Tooltip';

export interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onReset'> {
  // Function to use when reset is clicked. Means you have to reset the input value yourself as this is  uncontrolled
  // component (or do something else if required).
  onReset: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  isConfigured: boolean;

  label?: string;
  tooltip?: PopoverContent;
  labelWidth?: number;
  inputWidth?: number;
  // Placeholder of the input field when in non configured state.
  placeholder?: string;
  interactive?: boolean;
}

const getSecretFormFieldStyles = () => {
  return {
    noRadiusInput: css`
      border-bottom-right-radius: 0 !important;
      border-top-right-radius: 0 !important;
    `,
    noRadiusButton: css`
      border-bottom-left-radius: 0 !important;
      border-top-left-radius: 0 !important;
    `,
  };
};
/**
 * Form field that has 2 states configured and not configured. If configured it will not show its contents and adds
 * a reset button that will clear the input and makes it accessible. In non configured state it behaves like normal
 * form field. This is used for passwords or anything that is encrypted on the server and is later returned encrypted
 * to the user (like datasource passwords).
 */
export const SecretFormField = ({
  label = 'Password',
  labelWidth,
  inputWidth = 12,
  onReset,
  isConfigured,
  tooltip,
  placeholder = 'Password',
  interactive,
  ...inputProps
}: Props) => {
  const styles = getSecretFormFieldStyles();
  return (
    <FormField
      label={label!}
      tooltip={tooltip}
      interactive={interactive}
      labelWidth={labelWidth}
      inputEl={
        isConfigured ? (
          <>
            <input
              type="text"
              className={cx(`gf-form-input width-${inputWidth}`, styles.noRadiusInput)}
              disabled={true}
              value="configured"
              {...omit(inputProps, 'value')}
            />
            <Button onClick={onReset} variant="secondary" type="button">
              Reset
            </Button>
          </>
        ) : (
          <input
            type="password"
            className={`gf-form-input width-${inputWidth}`}
            placeholder={placeholder}
            {...inputProps}
          />
        )
      }
    />
  );
};

SecretFormField.displayName = 'SecretFormField';
