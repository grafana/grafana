import React, { SFC } from 'react';
import { Label } from '..';

interface Props {
  label: string;
  inputProps: {};
  labelWidth?: number;
  inputWidth?: number;
}

const defaultProps = {
  labelWidth: 6,
  inputProps: {},
  inputWidth: 12,
};

const FormGroup: SFC<Props> = ({ label, labelWidth, inputProps, inputWidth }) => {
  return (
    <div className="gf-form">
      <Label width={labelWidth}>{label}</Label>
      <input type="text" className={`gf-form-input width-${inputWidth}`} {...inputProps} />
    </div>
  );
};

FormGroup.defaultProps = defaultProps;
export { FormGroup };
