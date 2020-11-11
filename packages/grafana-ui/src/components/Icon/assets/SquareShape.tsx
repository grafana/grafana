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
      <path d="M17,2H7C4.2,2,2,4.2,2,7v10c0,2.8,2.2,5,5,5h10c2.8,0,5-2.2,5-5V7C22,4.2,19.8,2,17,2z" />
    </svg>
  );
};
