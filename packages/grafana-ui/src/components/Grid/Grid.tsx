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

export interface GridItemProps {
  children: NonNullable<React.ReactNode>;
  /** If false will the grid item inherits the display of the parent. 
  If true, the display with 'contents' as value. See info: https://developer.mozilla.org/en-US/docs/Web/CSS/display#display_contents*/
  displayContents?: boolean;
  /** Specifies the column where the grid item starts within the grid */
  columnStart?: number;
  /** Specifies the  column where the grid item starts. 
  If its value is span <number> the item spans across the provider number of columns*/
  columnEnd?: number | `span ${number}`;
  /** Specifies the row where the grid item starts within the grid */
  rowStart?: number;
  /** Specifies the row where the grid item ends.*/
  rowEnd?: number | `span ${number}`;
}

export const Grid = ({
  children,
  display = 'grid',
  gap = 1,
  columnGap = 0,
  rowGap = 0,
  templateColumns = 'none',
  templateRows = 'none',
  alignItems = 'stretch',
  justifyItems = 'stretch',
  autoFlow = 'row',
  autoRows = 'auto',
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
  // @ts-ignore
  return React.createElement('div', { className: styles.grid }, children);
};

Grid.displayName = 'Grid';

const getGridStyles = (
  theme: GrafanaTheme2,
  display: 'grid' | 'inline-grid',
  gap: ThemeSpacingTokens,
  columnGap: ThemeSpacingTokens,
  rowGap: ThemeSpacingTokens,
  templateColumns: GridProps['templateColumns'],
  templateRows: GridProps['templateRows'],
  alignItems: GridProps['alignItems'],
  justifyItems: GridProps['justifyItems'],
  autoFlow: GridProps['autoFlow'],
  autoRows: GridProps['autoRows']
) => {
  return {
    grid: css({
      display,
      gap: rowGap || columnGap ? undefined : theme.spacing(gap),
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

export const GridItem = ({
  children,
  displayContents = false,
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
}: GridItemProps) => {
  const styles = useStyles2(
    useCallback(
      () => getGridItemStyles(displayContents, columnStart, columnEnd, rowStart, rowEnd),
      [displayContents, columnStart, columnEnd, rowStart, rowEnd]
    )
  );

  return React.createElement('div', { className: styles.gridItem }, children);
};

GridItem.displayName = 'GridItem';

const getGridItemStyles = (
  displayContents: GridItemProps['displayContents'],
  columnStart: GridItemProps['columnStart'],
  columnEnd: GridItemProps['columnEnd'],
  rowStart: GridItemProps['rowStart'],
  rowEnd: GridItemProps['rowEnd']
) => {
  return {
    gridItem: css({
      display: displayContents ? 'contents' : 'inherit',
      gridColumnStart: columnStart,
      gridColumnEnd: columnEnd,
      gridRowStart: rowStart,
      gridRowEnd: rowEnd,
    }),
  };
};
