import { css } from '@emotion/css';
import React, { forwardRef, HTMLAttributes } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';

interface GridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: NonNullable<React.ReactNode>;

  /** Specifies the gutters between columns and rows. It is overwritten when a column or row gap has a value */
  gap?: ThemeSpacingTokens;

  /** Number of columns */
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

  /** For a responsive layout, fit as many columns while maintaining this minimum column width.
   *  The real width will be calculated based on the theme spacing tokens: `theme.spacing(minColumnWidth)`
   */
  minColumnWidth?: 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 44 | 55 | 72 | 89 | 144;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>((props, ref) => {
  const { children, gap, columns, minColumnWidth, ...rest } = props;
  const styles = useStyles2(getGridStyles, gap, columns, minColumnWidth);

  return (
    <div ref={ref} {...rest} className={styles.grid}>
      {children}
    </div>
  );
});

Grid.displayName = 'Grid';

const getGridStyles = (
  theme: GrafanaTheme2,
  gap: GridProps['gap'],
  columns: GridProps['columns'],
  minColumnWidth: GridProps['minColumnWidth']
) => {
  return {
    grid: css([
      {
        display: 'grid',
        gap: gap ? theme.spacing(gap) : undefined,
      },
      minColumnWidth && {
        gridTemplateColumns: `repeat(auto-fill, minmax(${theme.spacing(minColumnWidth)}, 1fr))`,
      },
      columns && {
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      },
    ]),
  };
};
