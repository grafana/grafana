import React, { FC, ComponentType } from 'react';
import { SvgProps } from '../assets/types';

const InterpolationLinear: FC<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.5 20" width={'30px'} height={size} {...rest}>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Icons">
          <circle cx="14.17" cy="2.67" r="2.67" />
          <circle cx="25.83" cy="17.33" r="2.67" />
          <rect x="19.25" y="-1.21" width="1.5" height="22.42" transform="translate(-1.79 15.03) rotate(-39.57)" />
          <circle cx="2.67" cy="17.33" r="2.67" />
          <rect x="-2.71" y="9.25" width="22.42" height="1.5" transform="translate(-4.62 10.18) rotate(-50.44)" />
        </g>
      </g>
    </svg>
  );
};

const InterpolationSmooth: FC<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.34 20" width={'30px'} height={size} {...rest}>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Icons">
          <circle cx="14.17" cy="2.67" r="2.67" />
          <circle cx="2.67" cy="17.33" r="2.67" />
          <path d="M3.42,17.33H1.92c0-6.46,4.39-15.41,12.64-15.41v1.5C7.29,3.42,3.42,11.5,3.42,17.33Z" />
          <circle cx="25.67" cy="17.33" r="2.67" />
          <path d="M26.42,17.33h-1.5c0-5.83-3.87-13.91-11.14-13.91V1.92C22,1.92,26.42,10.87,26.42,17.33Z" />
        </g>
      </g>
    </svg>
  );
};

const InterpolationStepBefore: FC<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.34 20" width={'30px'} height={size} {...rest}>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Icons">
          <circle cx="14.17" cy="2.67" r="2.67" />
          <circle cx="2.67" cy="17.33" r="2.67" />
          <circle cx="25.67" cy="17.33" r="2.67" />
          <polygon points="3.42 17.33 1.92 17.33 1.92 1.92 13.78 1.92 13.78 3.42 3.42 3.42 3.42 17.33" />
          <polygon points="25.67 18.08 13.42 18.08 13.42 2.67 14.92 2.67 14.92 16.58 25.67 16.58 25.67 18.08" />
        </g>
      </g>
    </svg>
  );
};

const InterpolationStepAfter: FC<SvgProps> = ({ size, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.34 20" width={'30px'} height={size} {...rest}>
      <g id="Layer_2" data-name="Layer 2">
        <g id="Icons">
          <circle cx="14.17" cy="2.67" r="2.67" />
          <circle cx="25.67" cy="17.33" r="2.67" />
          <circle cx="2.67" cy="17.33" r="2.67" />
          <polygon points="26.42 17.33 24.92 17.33 24.92 3.42 14.56 3.42 14.56 1.92 26.42 1.92 26.42 17.33" />
          <polygon points="14.92 18.08 2.67 18.08 2.67 16.58 13.42 16.58 13.42 2.67 14.92 2.67 14.92 18.08" />
        </g>
      </g>
    </svg>
  );
};

const IconNotFound: FC<SvgProps> = ({ size, ...rest }) => {
  return <svg width={size} height={size} {...rest} />;
};

export const customIcons: Record<string, ComponentType<SvgProps>> = {
  'gf-interpolation-linear': InterpolationLinear,
  'gf-interpolation-smooth': InterpolationSmooth,
  'gf-interpolation-step-before': InterpolationStepBefore,
  'gf-interpolation-step-after': InterpolationStepAfter,
  notFoundDummy: IconNotFound,
};
