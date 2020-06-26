import omit from 'lodash/omit';
import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormField } from '../FormField/FormField';
import { Button } from '../Button/Button';
import { css, cx } from 'emotion';

export interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onReset'> {
  // Function to use when reset is clicked. Means you have to reset the input value yourself as this is  uncontrolled
  // component (or do something else if required).
  onReset: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  isConfigured: boolean;

  label?: string;
  tooltip?: string;
  labelWidth?: number;
  inputWidth?: number;
  // Placeholder of the input field when in non configured state.
  placeholder?: string;
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
export const SecretFormField: FunctionComponent<Props> = ({
  label = 'Password',
  labelWidth,
  inputWidth = 12,
  onReset,
  isConfigured,
  tooltip,
  placeholder = 'Password',
  ...inputProps
}: Props) => {
  const styles = getSecretFormFieldStyles();
  return (
    <FormField
      label={label!}
      tooltip={tooltip!}
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
            <Button onClick={onReset} variant="secondary">
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
