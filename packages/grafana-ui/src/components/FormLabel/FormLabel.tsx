import React, { FunctionComponent, ReactNode } from 'react';
import classNames from 'classnames';
import { Tooltip } from '../Tooltip/Tooltip';
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
  const classes = classNames(`gf-form-label width-${width ? width : '10'}`, className, {
    'gf-form-label--is-focused': isFocused,
    'gf-form-label--is-invalid': isInvalid,
  });

  return (
    <label className={classes} {...rest} htmlFor={htmlFor}>
      {children}
      {tooltip && (
        <Tooltip placement="top" content={tooltip} theme={'info'}>
          <div className="gf-form-help-icon gf-form-help-icon--right-normal">
            <i className="fa fa-info-circle" />
          </div>
        </Tooltip>
      )}
    </label>
  );
};
