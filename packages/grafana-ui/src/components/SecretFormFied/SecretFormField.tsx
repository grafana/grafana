import { omit } from 'lodash';
import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormField } from '..';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  onReset: () => void;
  isConfigured: boolean;

  label?: string;
  labelWidth?: number;
  inputWidth?: number;
}

export const SecretFormField: FunctionComponent<Props> = ({
  label,
  labelWidth,
  inputWidth,
  onReset,
  isConfigured,
  ...inputProps
}: Props) => {
  return (
    <FormField
      label={label || 'Password'}
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
            placeholder={'password'}
            {...inputProps}
          />
        )
      }
    />
  );
};

SecretFormField.defaultProps = {
  inputWidth: 12,
};
SecretFormField.displayName = 'SecretFormField';
