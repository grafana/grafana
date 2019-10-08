import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { Input } from '@grafana/ui';
import { cx } from 'emotion';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  grow?: boolean;
  labelWidth?: number;
  inputWidth?: number;
  inputEl?: React.ReactNode;
}

const defaultProps = {
  labelWidth: 6,
  inputWidth: 12,
  grow: false,
};

export const FormField: FunctionComponent<Props> = ({
  label,
  labelWidth,
  inputWidth,
  inputEl,
  className,
  grow,
  ...inputProps
}) => {
  return (
    <div className={cx('gf-form', className)}>
      <span className={`gf-form-label query-keyword width-${labelWidth}`}>{label}</span>
      {inputEl || (
        <Input type="text" className={`gf-form-input ${inputWidth ? `width-${inputWidth}` : ''}`} {...inputProps} />
      )}
      {grow && (
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;
