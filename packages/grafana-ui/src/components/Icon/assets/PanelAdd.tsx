import React, { FunctionComponent } from 'react';
import { SvgProps } from './types';

export const PanelAdd: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 117.8 64"
      viewBox="0 0 117.8 64"
      xmlSpace="preserve"
      width={size}
      height={size}
      {...rest}
    >
      <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="96.4427" y1="83.7013" x2="96.4427" y2="-9.4831">
        <stop offset="0" style={{ stopColor: '#FFF23A' }} />
        <stop offset="4.010540e-02" style={{ stopColor: '#FEE62D' }} />
        <stop offset="0.1171" style={{ stopColor: '#FED41A' }} />
        <stop offset="0.1964" style={{ stopColor: '#FDC90F' }} />
        <stop offset="0.2809" style={{ stopColor: '#FDC60B' }} />
        <stop offset="0.6685" style={{ stopColor: '#F28F3F' }} />
        <stop offset="0.8876" style={{ stopColor: '#ED693C' }} />
        <stop offset="1" style={{ stopColor: '#E83E39' }} />
      </linearGradient>
      <path
        d="M15.2,22.7H1.9c-1.1,0-1.9,0.9-1.9,1.9v37.5C0,63.2,0.9,64,1.9,64h13.3c1.1,0,1.9-0.9,1.9-1.9V24.6
		C17.1,23.5,16.3,22.7,15.2,22.7z"
      />
      <path
        d="M36.3,10.2H23c-1.1,0-1.9,0.9-1.9,1.9v50c0,1.1,0.9,1.9,1.9,1.9h13.3c1.1,0,1.9-0.9,1.9-1.9v-50
		C38.2,11.1,37.3,10.2,36.3,10.2z"
      />
      <path
        d="M57.3,32H44c-1.1,0-1.9,0.9-1.9,1.9v28.1c0,1.1,0.9,1.9,1.9,1.9h13.3c1.1,0,1.9-0.9,1.9-1.9V34
		C59.2,32.9,58.4,32,57.3,32z"
      />
      <path
        d="M70.1,38V26.1c0-3.4,2.7-6.1,6.1-6.1h4.1V2c0-1.1-0.9-1.9-1.9-1.9H65.1C64,0,63.1,0.9,63.1,2v60.1
		c0,1.1,0.9,1.9,1.9,1.9h13.3c1.1,0,1.9-0.9,1.9-1.9V44.1h-4.1C72.9,44.1,70.1,41.3,70.1,38z"
      />
      <path
        fill="url(#SVGID_1_)"
        d="M116.7,24.9h-7.2h-0.5h-5.4V11.8c0-0.6-0.5-1.1-1.1-1.1H90.5c-0.6,0-1.1,0.5-1.1,1.1v13.1h-9.1h-4.1
		c-0.6,0-1.1,0.5-1.1,1.1V38c0,0.6,0.5,1.1,1.1,1.1h4.1h9.1v4.6v1.9v6.7c0,0.6,0.5,1.1,1.1,1.1h11.9c0.6,0,1.1-0.5,1.1-1.1V39.1
		h13.1c0.6,0,1.1-0.5,1.1-1.1V26.1C117.8,25.5,117.3,24.9,116.7,24.9z"
      />
    </svg>
  );
};
