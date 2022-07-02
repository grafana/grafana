import React from 'react';

import { IconButton } from '../IconButton/IconButton';
import { TooltipProps, PopoverContent } from '../Tooltip';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return <IconButton name="info-circle" tooltip={children} {...restProps} />;
};
