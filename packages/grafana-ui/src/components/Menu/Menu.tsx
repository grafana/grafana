import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';

/** @internal */
export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** React element rendered at the top of the menu */
  header?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
}

/** @internal */
export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(
  ({ header, children, ariaLabel, ...otherProps }, ref) => {
    const styles = useStyles(getStyles);

    return (
      <div {...otherProps} ref={ref} className={styles.wrapper} aria-label={ariaLabel}>
        {header && <div className={styles.header}>{header}</div>}
        {children}
      </div>
    );
  }
);
Menu.displayName = 'Menu';

/** @internal */
const getStyles = (theme: GrafanaTheme) => {
  return {
    header: css`
      padding: ${theme.v2.spacing(0.5, 0.5, 1, 0.5)};
      border-bottom: 1px solid ${theme.v2.palette.border.medium};
    `,
    wrapper: css`
      background: ${theme.v2.palette.background.secondary};
      box-shadow: ${theme.v2.shadows.z2};
      display: inline-block;
      border-radius: ${theme.v2.shape.borderRadius()};
    `,
  };
};
