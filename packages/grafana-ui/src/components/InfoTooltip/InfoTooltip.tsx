import React from 'react';
import { Tooltip, TooltipProps } from '../Tooltip/Tooltip';
import { TooltipContent } from '../Tooltip/PopperController';

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
