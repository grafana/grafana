import React, { FC } from 'react';

export const DisabledSquare: FC = (props) => (
  <svg width="14" height="14" fill="none" {...props} xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M13 13H1V1h12v12z" strokeLinecap="round" strokeLinejoin="round" />
    <path
      clipRule="evenodd"
      d="M9.609 7a2.61 2.61 0 10-5.22.002A2.61 2.61 0 009.61 7v0z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
