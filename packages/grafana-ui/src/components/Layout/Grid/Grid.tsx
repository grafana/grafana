import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';

export interface GridProps {
  children: NonNullable<React.ReactNode>;
  /** Defines whether the element is a block-level or an inline-level grid */
  display?: 'grid' | 'inline-grid';
  /** Specifies the gutters between columns and rows. It is overwritten when a column or row gap has a value */
  gap?: ThemeSpacingTokens;
}

export const Grid = ({ children, display = 'grid', gap }: GridProps) => {
  const styles = useStyles2(getGridStyles, display, gap);

  return <div className={styles.grid}>{children}</div>;
};

Grid.displayName = 'Grid';

const getGridStyles = (theme: GrafanaTheme2, display: 'grid' | 'inline-grid', gap?: ThemeSpacingTokens) => {
  return {
    grid: css({
      display,
      gap: gap ? theme.spacing(gap) : undefined,
    }),
  };
};
