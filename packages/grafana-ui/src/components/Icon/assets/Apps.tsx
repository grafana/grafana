import React, { FunctionComponent } from 'react';
import { SvgProps } from '../Icon';

const Svg: FunctionComponent<SvgProps> = ({ size, color, secondaryColor, ...rest }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <rect width="9" height="9" x="2" y="2" fill={color} rx="1" />
      <rect width="9" height="9" x="2" y="13" fill={secondaryColor} rx="1" />
      <rect width="9" height="9" x="13" y="2" fill={secondaryColor} rx="1" />
      <rect width="9" height="9" x="13" y="13" fill={secondaryColor} rx="1" />
    </svg>
  );
};

export default Svg;
