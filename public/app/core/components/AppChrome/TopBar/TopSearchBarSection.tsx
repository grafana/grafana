import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';

export interface TopSearchBarSectionProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export function TopSearchBarSection({ children, align = 'left' }: TopSearchBarSectionProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(!window.matchMedia(`(min-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e: MediaQueryListEvent) => {
      setIsSmallScreen(!e.matches);
    },
  });

  if (isSmallScreen) {
    return <>{children}</>;
  }

  return (
    <div data-test-id="wrapper" className={cx(styles.wrapper, { [styles[align]]: align === 'right' })}>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
