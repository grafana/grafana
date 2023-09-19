import { css } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';

export interface GridProps {
  children: NonNullable<React.ReactNode>;
  /** Defines whether the element is a block-level or an inline-level grid */
  display?: 'grid' | 'inline-grid';
  /** Specifies the gutters between columns and rows. It is overwritten when a column or row gap has a value */
  gap?: ThemeSpacingTokens;
  /** Specifies the gutters between columns */
  columnGap?: ThemeSpacingTokens;
  /** Specifies the gutters between rows */
  rowGap?: ThemeSpacingTokens;
  /** Defines the columns of the grid */
  templateColumns?: CSSProperties['gridTemplateColumns'];
  /** Defines the rows of the grid */
  templateRows?: CSSProperties['gridTemplateRows'];
  /** Defines the horizontal alignment of the grid items in each cell */
  justifyItems?: CSSProperties['justifyItems'];
  /** Defines the vertical alignment of the grid items in each cell */
  alignItems?: CSSProperties['alignItems'];
  /** Determines how grid items are automatically placed, with options to arrange them in rows, columns, or a "dense" manner to minimize empty cells */
  autoFlow?: CSSProperties['gridAutoFlow'];
  /** Specifies the height of rows automatically created to accommodate grid items not explicitly placed within the grid */
  autoRows?: CSSProperties['gridAutoRows'];
}

export const Grid = ({
  children,
  display = 'grid',
  gap,
  columnGap,
  rowGap,
  templateColumns,
  templateRows,
  alignItems,
  justifyItems,
  autoFlow,
  autoRows,
}: GridProps) => {
  const styles = useStyles2(
    getGridStyles,
    display,
    gap,
    columnGap,
    rowGap,
    templateColumns,
    templateRows,
    alignItems,
    justifyItems,
    autoFlow,
    autoRows
  );

  return <div className={styles.grid}>{children}</div>;
};

Grid.displayName = 'Grid';

const getGridStyles = (
  theme: GrafanaTheme2,
  display: 'grid' | 'inline-grid',
  gap?: ThemeSpacingTokens,
  columnGap?: ThemeSpacingTokens,
  rowGap?: ThemeSpacingTokens,
  templateColumns?: GridProps['templateColumns'],
  templateRows?: GridProps['templateRows'],
  alignItems?: GridProps['alignItems'],
  justifyItems?: CSSProperties['justifyItems'],
  autoFlow?: GridProps['autoFlow'],
  autoRows?: GridProps['autoRows']
) => {
  return {
    grid: css({
      display,
      gap: gap ? theme.spacing(gap) : undefined,
      columnGap: columnGap ? theme.spacing(columnGap) : undefined,
      rowGap: rowGap ? theme.spacing(rowGap) : undefined,
      gridTemplateColumns: templateColumns,
      gridTemplateRows: templateRows,
      justifyContent: 'stretch',
      alignContent: 'stretch',
      justifyItems,
      alignItems,
      gridAutoFlow: autoFlow,
      gridAutoRows: autoRows,
    }),
  };
};
