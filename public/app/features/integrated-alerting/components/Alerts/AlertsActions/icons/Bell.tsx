import React, { FC, SVGProps } from 'react';

export const Bell: FC<SVGProps<SVGSVGElement>> = props => (
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
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12.7 5.5V2.35C12.7 1.6048 12.0952 1 11.35 1L8.65 1C7.9048 1 7.3 1.6048 7.3 2.35V5.5L0.999999 11.8L19 11.8L12.7 5.5Z"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M13.1499 14.5C12.4137 15.5125 11.3481 16.3 9.9999 16.3C8.6517 16.3 7.5861 15.5134 6.8499 14.5"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
