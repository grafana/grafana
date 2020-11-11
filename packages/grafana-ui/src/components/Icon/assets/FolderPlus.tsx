import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const FolderPlus: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...rest}
    >
      <path d="M19,6h-6.3l-0.3-0.9C12,3.8,10.9,3,9.6,3H5C3.3,3,2,4.3,2,6v13c0,1.7,1.3,3,3,3h14c1.7,0,3-1.3,3-3V9C22,7.3,20.7,6,19,6z M14,15h-1v1c0,0.6-0.4,1-1,1s-1-0.4-1-1v-1h-1c-0.6,0-1-0.4-1-1s0.4-1,1-1h1v-1c0-0.6,0.4-1,1-1s1,0.4,1,1v1h1c0.6,0,1,0.4,1,1S14.6,15,14,15z" />
    </svg>
  );
};
