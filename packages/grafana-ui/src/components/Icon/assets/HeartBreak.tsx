import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const HeartBreak: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Layer_1-2" data-name="Layer 1">
          <path d="M18.17,1.85h0A6.25,6.25,0,0,0,12.12.23L9.42,6.56l2.83.71a1,1,0,0,1,.67,1.41l-2,4a1,1,0,0,1-.9.56,1.13,1.13,0,0,1-.44-.1h0a1,1,0,0,1-.46-1.33l1.4-2.89-2.77-.7a1,1,0,0,1-.65-.53,1,1,0,0,1,0-.83L9.58,1a6.27,6.27,0,0,0-7.73,9.77L9.3,18.18a1,1,0,0,0,1.42,0h0l7.45-7.46A6.27,6.27,0,0,0,18.17,1.85Z" />
        </g>
      </g>
    </svg>
  );
};
