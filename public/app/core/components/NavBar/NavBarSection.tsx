import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import config from '../../config';

export interface Props {
  children: ReactNode;
  className?: string;
}

export function NavBarSection({ children, className }: Props) {
  const newNavigationEnabled = config.featureToggles.newNavigation;
  const theme = useTheme2();
  const styles = getStyles(theme, newNavigationEnabled);

  return (
    <div data-testid="navbar-section" className={cx(styles.container, className)}>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, newNavigationEnabled: boolean) => ({
  container: css`
    display: none;

    ${theme.breakpoints.up('md')} {
      background-color: ${newNavigationEnabled ? theme.colors.background.primary : 'inherit'};
      border: ${newNavigationEnabled ? `1px solid ${theme.components.panel.borderColor}` : 'none'};
      border-radius: 2px;
      display: flex;
      flex-direction: inherit;
    }
  `,
});
