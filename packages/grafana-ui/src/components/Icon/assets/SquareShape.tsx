import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const SquareShape: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...rest}
    >
      <rect width="85%" height="85%" x="2" y="2" rx="5" />
    </svg>
  );
};
