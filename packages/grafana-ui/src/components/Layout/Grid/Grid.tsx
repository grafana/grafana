import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';

type GridProps = GridPropsBase & (GridColumnsProps | GridMinColumnWidthProps);

interface GridColumnsProps {
  columns: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

interface GridMinColumnWidthProps {
  minColumnWidth: 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89 | 144;
}

export interface GridPropsBase {
  children: NonNullable<React.ReactNode>;
  /** Specifies the gutters between columns and rows. It is overwritten when a column or row gap has a value */
  gap?: ThemeSpacingTokens;
}

export const Grid = (props: GridProps) => {
  const columns = 'columns' in props ? props.columns : undefined;
  const minColumnWidth = 'minColumnWidth' in props ? props.minColumnWidth : undefined;
  const styles = useStyles2(getGridStyles, props.gap, columns, minColumnWidth);

  return <div className={styles.grid}>{props.children}</div>;
};

Grid.displayName = 'Grid';

const getGridStyles = (
  theme: GrafanaTheme2,
  gap?: ThemeSpacingTokens,
  columns?: GridColumnsProps['columns'],
  minColumnWidth?: GridMinColumnWidthProps['minColumnWidth']
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
