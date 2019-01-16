import React, { FunctionComponent, ReactNode } from 'react';
import classNames from 'classnames';
import { Tooltip } from '..';

interface Props {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  isFocused?: boolean;
  isInvalid?: boolean;
  tooltip?: string;
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
  const classes = classNames(`gf-form-label width-${width ? width : '10'}`, className, {
    'gf-form-label--is-focused': isFocused,
    'gf-form-label--is-invalid': isInvalid,
  });

  return (
    <label className={classes} {...rest} htmlFor={htmlFor}>
      {children}
      {tooltip && (
        <Tooltip placement="auto" content={tooltip}>
          <div className="gf-form-help-icon--right-normal">
            <i className="gicon gicon-question gicon--has-hover" />
          </div>
        </Tooltip>
      )}
    </label>
  );
};
