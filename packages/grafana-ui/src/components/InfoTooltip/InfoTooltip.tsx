import React from 'react';
import { Tooltip, TooltipProps, PopoverContent } from '../Tooltip/Tooltip';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return (
    <Tooltip content={children} {...restProps}>
      <i className="fa fa-info-circle" />
    </Tooltip>
  );
};
