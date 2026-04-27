import { css, cx } from '@emotion/css';
import * as React from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { useTheme2 } from '@grafana/ui/themes';

interface HorizontalGroupProps {
  children: React.ReactNode;
  wrap?: boolean;
  className?: string;
}

export const HorizontalGroup = ({ children, wrap, className }: HorizontalGroupProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, wrap);

  return <div className={cx(styles.container, className)}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2, wrap?: boolean) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    '& > *': {
      marginBottom: theme.spacing(),
      marginRight: theme.spacing(),
    },
    '& > *:last-child': {
      marginRight: 0,
    },
  }),
});
