import React, { FunctionComponent } from 'react';
import { SvgProps } from '../types';

export const PerconaInventory: FunctionComponent<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg width={size} height={size} {...rest} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.94602 8.89221L9.6093 9.55549L7.84915 11.3156L6.67493 10.1438L7.33821 9.48049L7.84915 9.99143L8.94602 8.89221Z"
        fill="#9FA7B3"
      />
      <path
        d="M16.4273 2.4679V4.04524H7.57258V2.4679H3.1593V22.6406H20.8382V2.4679H16.4273ZM5.87805 19.0429V14.5148H10.4062V19.0429H5.87805ZM11.8288 9.47102H17.7702V10.4085H11.8288V9.47102ZM11.8288 16.3101H17.7702V17.2476H11.8288V16.3101ZM10.4062 7.67571V12.2038H5.87805V7.67571H10.4062Z"
        fill="#9FA7B3"
      />
      <path
        d="M15.7242 1.73906V3.34219H8.27576V1.73906C8.27576 1.53047 8.44685 1.35938 8.65544 1.35938H15.3445C15.5554 1.35938 15.7242 1.53047 15.7242 1.73906Z"
        fill="#9FA7B3"
      />
    </svg>
  );
};
