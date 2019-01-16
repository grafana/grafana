import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormLabel } from '..';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelWidth?: number;
  inputWidth?: number;
}

const defaultProps = {
  labelWidth: 6,
  inputWidth: 12,
};

const FormField: FunctionComponent<Props> = ({ label, labelWidth, inputWidth, ...inputProps }) => {
  return (
    <div className="form-field">
      <FormLabel width={labelWidth}>{label}</FormLabel>
      <input type="text" className={`gf-form-input width-${inputWidth}`} {...inputProps} />
    </div>
  );
};

FormField.defaultProps = defaultProps;
export { FormField };
