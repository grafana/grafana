import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

interface TopBarLayoutProps {
  children: React.ReactNode;
}

export function TopBarLayout({ children }: TopBarLayoutProps) {
  const styles = useStyles2(getStyles);

  return <div className={styles.layout}>{children}</div>;
}

interface TopBarWrapperProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

function TopBarWrapper({ children, align = 'left' }: TopBarWrapperProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e: MediaQueryListEvent) => {
      setIsSmallScreen(e.matches);
    },
    value: isSmallScreen,
  });

  if (isSmallScreen) {
    return <>{children}</>;
  }

  return <div className={cx(styles.wrapper, { [styles[align]]: align === 'right' })}>{children}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    height: TOP_BAR_LEVEL_HEIGHT,
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
    padding: theme.spacing(0, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',

    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: '1fr 2fr 1fr',
      display: 'grid',

      justifyContent: 'flex-start',
    },
  }),

  wrapper: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
  }),

  right: css({
    justifyContent: 'flex-end',
  }),
  left: css({}),
  center: css({}),
});

TopBarLayout.TopBarWrapper = TopBarWrapper;
