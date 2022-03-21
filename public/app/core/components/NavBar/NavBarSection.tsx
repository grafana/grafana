import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export interface Props {
  children: ReactNode;
  className?: string;
}

export function NavBarSection({ children, className }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <ul data-testid="navbar-section" className={cx(styles.container, className)}>
      {children}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: none;
    list-style: none;

    ${theme.breakpoints.up('md')} {
      display: flex;
      flex-direction: inherit;
    }
  `,
});
