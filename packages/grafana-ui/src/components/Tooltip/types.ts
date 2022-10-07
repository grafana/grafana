/**
 * This API allows popovers to update Popper's position when e.g. popover content changes
 * updatePopperPosition is delivered to content by react-popper.
 */
export interface PopoverContentProps {
  // Is this used anywhere in plugins? Can we remove it or rename it to just update?
  updatePopperPosition?: () => void;
}

export type PopoverContent = string | React.ReactElement | ((props: PopoverContentProps) => JSX.Element);

export type TooltipPlacement =
  | 'auto-start'
  | 'auto'
  | 'auto-end'
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'right-start'
  | 'right'
  | 'right-end'
  | 'bottom-end'
  | 'bottom'
  | 'bottom-start'
  | 'left-end'
  | 'left'
  | 'left-start';
