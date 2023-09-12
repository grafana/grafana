import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

export type ItemsAlignment = 'start' | 'end' | 'center' | 'stretch';

export type ContentAlignment = ItemsAlignment | 'space-around' | 'space-between' | 'space-evenly';
export interface GridProps {
  children: NonNullable<React.ReactNode>;
  /** Defines whether the element is a block-lever or a inline-level grid */
  display?: 'grid' | 'inline-grid';
  /** Specifies the gutters between columns and between rows. It is overwritten when column or row gap has value */
  gap?: ThemeSpacingTokens;
  /** Specifies the gutters between columns */
  columnGap?: ThemeSpacingTokens;
  /** Specifies the gutters between rows */
  rowGap?: ThemeSpacingTokens;
  /** Defines the columns of the grid */
  templateColumns?: string;
  /** Defines the rows of the grid */
  templateRows?: string;
  /** Defines the horizontal alignment of the grid items in each cell */
  justifyItems?: ItemsAlignment;
  /** Defines the vertical alignment of the grid items in each cell */
  alignItems?: ItemsAlignment;
  /** Determines how grid items are automatically placed, with options to arrange them in rows, columns, or a "dense" manner to minimize empty cells */
  autoFlow?: 'row' | 'column' | 'row dense' | 'column dense';
  /** Specifies the height of rows automatically created to accommodate grid items not explicitly placed within the grid */
  autoRows?: string;
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
    useCallback(
      (theme) =>
        getGridStyles(
          theme,
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
        ),
      [display, columnGap, rowGap, gap, templateColumns, templateRows, alignItems, justifyItems, autoRows, autoFlow]
    )
  );
  return React.createElement('div', { className: styles.grid }, children);
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
  justifyItems?: GridProps['justifyItems'],
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


