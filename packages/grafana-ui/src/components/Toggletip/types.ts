export interface ToggletipContentProps {
  /**
   * @deprecated
   * This prop is deprecated and no longer has any effect as popper position updates automatically.
   * It will be removed in a future release.
   */
  update?: () => void;
}

export type ToggletipContent = string | React.ReactElement | ((props: ToggletipContentProps) => JSX.Element);
