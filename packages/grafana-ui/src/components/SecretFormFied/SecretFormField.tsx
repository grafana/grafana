import { omit } from 'lodash';
import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormField } from '..';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  // Function to use when reset is clicked. Means you have to reset the input value yourself as this is  uncontrolled
  // component (or do something else if required).
  onReset: () => void;
  isConfigured: boolean;

  label?: string;
  labelWidth?: number;
  inputWidth?: number;
  // Placeholder of the input field when in non configured state.
  placeholder?: string;
}

const defaultProps = {
  inputWidth: 12,
  placeholder: 'Password',
  label: 'Password',
};

/**
 * Form field that has 2 states configured and not configured. If configured it will not show its contents and adds
 * a reset button that will clear the input and makes it accessible. In non configured state it behaves like normal
 * form field. This is used for passwords or anything that is encrypted on the server and is later returned encrypted
 * to the user (like datasource passwords).
 */
export const SecretFormField: FunctionComponent<Props> = ({
  label,
  labelWidth,
  inputWidth,
  onReset,
  isConfigured,
  placeholder,
  ...inputProps
}: Props) => {
  return (
    <FormField
      label={label!}
      labelWidth={labelWidth}
      inputEl={
        isConfigured ? (
          <>
            <input
              type="text"
              className={`gf-form-input width-${inputWidth! - 2}`}
              disabled={true}
              value="configured"
              {...omit(inputProps, 'value')}
            />
            <button className="btn btn-secondary gf-form-btn" onClick={onReset}>
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

SecretFormField.defaultProps = defaultProps;
SecretFormField.displayName = 'SecretFormField';
