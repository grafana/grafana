import React from 'react';
import { Tooltip, TooltipProps, TooltipContent } from '../Tooltip/Tooltip';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: TooltipContent<any>;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return (
    <Tooltip content={children} {...restProps}>
      <i className="fa fa-info-circle" />
    </Tooltip>
  );
};
