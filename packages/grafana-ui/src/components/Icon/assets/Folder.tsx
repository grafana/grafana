import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Folder: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path d="M19,6h-6.3l-0.3-0.9C12,3.8,10.9,3,9.6,3H5C3.3,3,2,4.3,2,6v13c0,1.7,1.3,3,3,3h14c1.7,0,3-1.3,3-3V9C22,7.3,20.7,6,19,6z" />
    </svg>
  );
};
