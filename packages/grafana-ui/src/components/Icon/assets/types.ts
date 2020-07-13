import React from 'react';

export interface SvgProps extends React.HTMLAttributes<SVGElement> {
  size: number;
  secondaryColor?: string;
  className?: string;
}
