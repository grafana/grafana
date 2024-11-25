import { Placement } from '@floating-ui/react';

export interface PopoverContentProps {
  /**
   * @deprecated
   * This prop is deprecated and no longer has any effect as popper position updates automatically.
   * It will be removed in a future release.
   */
  updatePopperPosition?: () => void;

  hidePopper?: () => void;
}

// hidePopper is only available to popover content when it is passed as a function
export type PopoverContent = string | React.ReactElement | ((props: PopoverContentProps) => JSX.Element);

export type TooltipPlacement = Placement | 'auto' | 'auto-start' | 'auto-end';
