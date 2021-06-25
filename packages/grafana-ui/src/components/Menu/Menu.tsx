import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes';

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
    const styles = useStyles2(getStyles);

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
const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      padding: ${theme.spacing(0.5, 0.5, 1, 0.5)};
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    wrapper: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      display: inline-block;
      border-radius: ${theme.shape.borderRadius()};
    `,
  };
};
