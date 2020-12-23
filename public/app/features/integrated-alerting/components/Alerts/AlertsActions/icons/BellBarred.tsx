import React, { FC, SVGProps } from 'react';

export const BellBarred: FC<SVGProps<SVGSVGElement>> = props => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 20 20"
    fill="none"
    opacity="1"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M4.1499 8.65002L0.999902 11.8H8.6499" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <path
      d="M14.05 11.8H19L12.7 5.5V2.35C12.7 1.6048 12.0952 1 11.35 1L8.65 1C7.9048 1 7.3 1.6048 7.3 2.35V4.6"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M10 14.5C8.7571 14.5 7.75 13.4929 7.75 12.25V11.8"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M2 3L16 17" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
