import React from 'react';
import { Tooltip, TooltipProps, PopoverContent } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return (
    <Tooltip content={children} {...restProps}>
      <Icon name="info-circle" />
    </Tooltip>
  );
};
