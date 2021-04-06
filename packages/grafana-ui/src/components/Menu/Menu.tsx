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
  const wrapperBg = theme.colors.formInputBg;
  const wrapperShadow = theme.isDark ? theme.palette.black : theme.palette.gray3;
  const headerBg = theme.colors.formInputBg;
  const headerSeparator = theme.colors.border3;

  return {
    header: css`
      padding: 4px;
      border-bottom: 1px solid ${headerSeparator};
      background: ${headerBg};
      margin-bottom: ${theme.spacing.xs};
      border-radius: ${theme.border.radius.sm} ${theme.border.radius.sm} 0 0;
    `,
    wrapper: css`
      background: ${wrapperBg};
      box-shadow: 0 2px 5px 0 ${wrapperShadow};
      display: inline-block;
      border-radius: ${theme.border.radius.sm};
    `,
  };
};
