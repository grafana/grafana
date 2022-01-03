import React from 'react';
import { Tooltip, TooltipProps, PopoverContent } from '../Tooltip/Tooltip';
import { Button } from '../Button';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return (
    <Tooltip content={children} {...restProps}>
      <Button icon="info-circle" ghostMode={true} />
    </Tooltip>
  );
};
