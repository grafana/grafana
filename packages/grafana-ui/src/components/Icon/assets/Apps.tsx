import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const Apps: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <rect width="9" height="9" x="2" y="2" rx="1" />
      <rect width="9" height="9" x="2" y="13" rx="1" opacity="0.6" />
      <rect width="9" height="9" x="13" y="2" rx="1" opacity="0.6" />
      <rect width="9" height="9" x="13" y="13" rx="1" opacity="0.6" />
    </svg>
  );
};
