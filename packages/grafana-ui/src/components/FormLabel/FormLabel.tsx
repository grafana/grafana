import classNames from 'classnames';
import React, { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';
import { Tooltip, PopoverContent } from '../Tooltip';

interface Props {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  isFocused?: boolean;
  isInvalid?: boolean;
  tooltip?: PopoverContent;
  width?: number | 'auto';
  /** Make tooltip interactive */
  interactive?: boolean;
}

export const FormLabel = ({
  children,
  isFocused,
  isInvalid,
  className,
  htmlFor,
  tooltip,
  width,
  interactive,
  ...rest
}: Props) => {
  const classes = classNames(className, `gf-form-label width-${width ? width : '10'}`, {
    'gf-form-label--is-focused': isFocused,
    'gf-form-label--is-invalid': isInvalid,
  });

  return (
    <label className={classes} {...rest} htmlFor={htmlFor}>
      {children}
      {tooltip && (
        <Tooltip placement="top" content={tooltip} theme={'info'} interactive={interactive}>
          <Icon tabIndex={0} name="info-circle" size="sm" style={{ marginLeft: '10px' }} />
        </Tooltip>
      )}
    </label>
  );
};

export const InlineFormLabel = FormLabel;
