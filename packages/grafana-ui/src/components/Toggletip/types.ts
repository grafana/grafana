/**
 * This API allows popovers to update Popper's position when e.g. popover content changes
 * update is delivered to content by react-popper.
 */
export interface ToggletipContentProps {
  update?: () => void;
}

export type ToggletipContent = string | React.ReactElement | ((props: ToggletipContentProps) => JSX.Element);

export type ToggletipPlacement =
  | 'auto'
  | 'auto-start'
  | 'auto-end'
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'left'
  | 'left-start'
  | 'left-end';
