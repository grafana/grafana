import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Heart: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path d="M20.8,5.7c-2.1-2.8-6-3.4-8.8-1.3C9.5,2.5,6,2.8,3.8,5c-2.4,2.4-2.5,6.4,0,8.9l6.2,6.2c0.5,0.5,1.2,0.8,1.9,0.8c0.7,0,1.4-0.3,1.9-0.8l6.2-6.2C22.4,11.6,22.6,8.2,20.8,5.7z" />
    </svg>
  );
};
