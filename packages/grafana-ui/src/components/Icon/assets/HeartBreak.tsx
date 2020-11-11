import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const HeartBreak: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path d="M20.2,4.6C18.6,3,16.3,2.4,14.1,3l-2.7,6.3l2.8,0.7c0.5,0.1,0.9,0.7,0.7,1.2c0,0.1,0,0.1-0.1,0.2l-2,4C12.7,15.8,12.4,16,12,16c-0.2,0-0.3,0-0.4-0.1c-0.5-0.2-0.7-0.8-0.5-1.3c0,0,0,0,0,0l1.4-2.9L9.8,11C9.2,10.8,8.9,10.3,9,9.8c0-0.1,0-0.1,0-0.1l2.5-5.8C8.7,1.9,4.8,2.8,3,5.7c-1.6,2.5-1.2,5.7,0.9,7.8l7.5,7.5c0.4,0.4,1,0.4,1.4,0l7.5-7.5C22.6,11,22.6,7.1,20.2,4.6z" />
    </svg>
  );
};
