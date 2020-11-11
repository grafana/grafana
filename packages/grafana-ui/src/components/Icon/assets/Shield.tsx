import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Shield: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path d="M20,4.2c-0.1-0.5-0.6-0.9-1.2-0.8c-2.2,0.5-4.4,0-6.2-1.3c-0.3-0.2-0.8-0.2-1.1,0C9.6,3.4,7.4,3.9,5.2,3.4c-0.1,0-0.1,0-0.2,0c-0.6,0-1,0.4-1,1v7.5c0,2.9,1.4,5.6,3.8,7.3l3.7,2.6c0.2,0.1,0.4,0.2,0.6,0.2c0.2,0,0.4-0.1,0.6-0.2l3.7-2.6c2.4-1.7,3.8-4.4,3.8-7.3V4.4C20,4.4,20,4.3,20,4.2z" />
    </svg>
  );
};
