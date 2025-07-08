import { IconButton } from '../IconButton/IconButton';
import { TooltipProps } from '../Tooltip/Tooltip';
import { PopoverContent } from '../Tooltip/types';

interface InfoTooltipProps extends Omit<TooltipProps, 'children' | 'content'> {
  children: PopoverContent;
}

/** @deprecated Use <IconButton name="info-circle" tooltip={children} /> instead */
export const InfoTooltip = ({ children, ...restProps }: InfoTooltipProps) => {
  return <IconButton name="info-circle" tooltip={children} {...restProps} />;
};
