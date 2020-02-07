import omit from 'lodash/omit';
import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormField } from '../FormField/FormField';
import { css, cx } from 'emotion';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onReset'> {
  // Function to use when reset is clicked. Means you have to reset the input value yourself as this is  uncontrolled
  // component (or do something else if required).
  onReset: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  isConfigured: boolean;

  label?: string;
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
  placeholder = 'Password',
  ...inputProps
}: Props) => {
  const styles = getSecretFormFieldStyles();
  return (
    <FormField
      label={label!}
      labelWidth={labelWidth}
      inputEl={
        isConfigured ? (
          <>
            <input
              type="text"
              className={cx(`gf-form-input width-${inputWidth! - 2}`, styles.noRadiusInput)}
              disabled={true}
              value="configured"
              {...omit(inputProps, 'value')}
            />
            <button
              className={cx('btn btn-secondary gf-form-btn', styles.noRadiusButton)}
              onClick={onReset}
              style={{ height: '100%' }}
            >
              reset
            </button>
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
