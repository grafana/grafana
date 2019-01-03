import React, { SFC, ReactNode } from 'react';
import classNames from 'classnames';

interface Props {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  isFocused?: boolean;
  isInvalid?: boolean;
}

export const GfFormLabel: SFC<Props> = ({ children, isFocused, isInvalid, className, htmlFor, ...rest }) => {
  const classes = classNames('gf-form-label', className, {
    'gf-form-label--is-focused': isFocused,
    'gf-form-label--is-invalid': isInvalid,
  });

  return (
    <label className={classes} {...rest} htmlFor={htmlFor}>
      {children}
    </label>
  );
};
