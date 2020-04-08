import React, { FunctionComponent } from 'react';
import { SvgProps } from '../Icon';

export const PanelAdd: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path fill="#6563ff" d="M21,4H20V3a1,1,0,0,0-2,0V4H17a1,1,0,0,0,0,2h1V7a1,1,0,0,0,2,0V6h1a1,1,0,0,0,0-2Z" />
      <rect width="6" height="13" x="2" y="9" rx="1" opacity="0.8" />
      <rect width="6" height="20" x="8" y="2" rx="1" />
      <rect width="6" height="11" x="14" y="11" opacity="0.7" rx="1" />
    </svg>
  );
};
