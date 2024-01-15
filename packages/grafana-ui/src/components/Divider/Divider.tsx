import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface DividerProps {
  direction?: 'vertical' | 'horizontal';
  spacing?: ThemeSpacingTokens;
  showLine?: boolean;
}

export const Divider = ({ direction = 'horizontal', spacing = 2, showLine = true }: DividerProps) => {
  const styles = useStyles2(getStyles, spacing, showLine);

  if (direction === 'vertical') {
    return <div className={styles.verticalDivider} data-testid="vertical-divider"></div>;
  } else {
    return <hr className={styles.horizontalDivider} data-testid="horizontal-divider" />;
  }
};

Divider.displayName = 'Divider';

const getStyles = (theme: GrafanaTheme2, spacing: ThemeSpacingTokens, showLine: boolean) => {
  return {
    horizontalDivider: css({
      borderTop: showLine ? `1px solid ${theme.colors.border.weak}` : 'none',
      margin: theme.spacing(spacing, 0),
      width: '100%',
    }),
    verticalDivider: css({
      borderRight: showLine ? `1px solid ${theme.colors.border.weak}` : 'none',
      margin: theme.spacing(0, spacing),
      height: '100%',
    }),
  };
};
