import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Bell: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...rest}
    >
      <path d="M18,13.2V10c0-2.9-2.1-5.4-5-5.9V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v1.1c-2.9,0.5-5,3-5,5.9v3.2c-1.2,0.4-2,1.5-2,2.8v2c0,0.6,0.4,1,1,1h3.1c0.5,2.1,2.7,3.4,4.8,2.9c1.4-0.4,2.5-1.5,2.9-2.9H19c0.6,0,1-0.4,1-1v-2C20,14.7,19.2,13.6,18,13.2z M12,20c-0.7,0-1.4-0.4-1.7-1h3.5C13.4,19.6,12.7,20,12,20z" />
    </svg>
  );
};
