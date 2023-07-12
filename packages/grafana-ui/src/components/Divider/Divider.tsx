import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';

interface DividerProps {
  direction?: 'vertical' | 'horizontal';
}

export const Divider = ({ direction = 'horizontal' }: DividerProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (direction === 'vertical') {
    return <div className={styles.verticalDivider}></div>;
  } else {
    return <hr className={styles.horizontalDivider} />;
  }
};

Divider.displayName = 'Divider';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    horizontalDivider: css`
      border-top: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(2, 0)};
      width: 100%;
    `,
    verticalDivider: css`
      border-right: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(0, 0.5)};
      height: 100%;
    `,
  };
};
