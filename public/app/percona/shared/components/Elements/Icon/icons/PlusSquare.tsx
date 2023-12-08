import React, { FC } from 'react';

export const PlusSquare: FC = (props) => (
  <svg width="14" height="14" fill="none" {...props} xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3.727v6.546M10.273 7H3.727" strokeLinecap="round" strokeLinejoin="round" />
    <path clipRule="evenodd" d="M13 13H1V1h12v12z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
