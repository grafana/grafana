import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Circle: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
};
