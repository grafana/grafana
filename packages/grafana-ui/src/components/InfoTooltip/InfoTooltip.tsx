import React from 'react';
import { Tooltip, TooltipProps, PopoverContent } from '../Tooltip/Tooltip';
import { Button } from '../Button';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return (
    <Tooltip content={children} {...restProps}>
      <Button variant="secondary" icon="info-circle" />
    </Tooltip>
  );
};
