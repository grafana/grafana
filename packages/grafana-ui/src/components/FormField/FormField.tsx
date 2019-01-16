import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { Label } from '..';

export interface Props {
  label: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  labelWidth?: number;
  inputWidth?: number;
}

const defaultProps = {
  labelWidth: 6,
  inputProps: {},
  inputWidth: 12,
};

const FormField: FunctionComponent<Props> = ({ label, labelWidth, inputProps, inputWidth }) => {
  return (
    <div className="form-field">
      <Label width={labelWidth}>{label}</Label>
      <input type="text" className={`gf-form-input width-${inputWidth}`} {...inputProps} />
    </div>
  );
};

FormField.defaultProps = defaultProps;
export { FormField };
