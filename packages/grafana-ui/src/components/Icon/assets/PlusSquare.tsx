import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const PlusSquare: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...rest}
    >
      <path d="M21,2H3C2.4,2,2,2.4,2,3v18c0,0.6,0.4,1,1,1h18c0.6,0,1-0.4,1-1V3C22,2.4,21.6,2,21,2z M17,13h-4v4c0,0.6-0.4,1-1,1s-1-0.4-1-1v-4H7c-0.6,0-1-0.4-1-1s0.4-1,1-1h4V7c0-0.6,0.4-1,1-1s1,0.4,1,1v4h4c0.6,0,1,0.4,1,1S17.6,13,17,13z" />
    </svg>
  );
};
