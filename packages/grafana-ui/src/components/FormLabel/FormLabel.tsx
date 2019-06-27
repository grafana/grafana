import React, { FunctionComponent, ReactNode } from 'react';
import classNames from 'classnames';
import { PopperContent } from '../Tooltip/PopperController';

interface Props {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  isFocused?: boolean;
  isInvalid?: boolean;
  tooltip?: PopperContent<any>;
  width?: number;
}

export const FormLabel: FunctionComponent<Props> = ({
  children,
  isFocused,
  isInvalid,
  className,
  htmlFor,
  tooltip,
  width,
  ...rest
}) => {
  const classes = classNames(`form-label width-${width ? width : '10'}`, className, {
    'form-label--is-focused': isFocused,
    'form-label--is-invalid': isInvalid,
  });

  return (
    <div>
      <label className={classes} {...rest} htmlFor={htmlFor}>
        {children}
      </label>
      <div className="form-label form-label--description">{tooltip}</div>
    </div>
  );
};
