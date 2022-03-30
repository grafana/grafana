import React from 'react';
import { TooltipProps, PopoverContent } from '../Tooltip';
import { IconButton } from '../IconButton/IconButton';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return <IconButton name="info-circle" tooltip={children} {...restProps} />;
};
