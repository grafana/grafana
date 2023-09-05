import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

export type ItemsAlignment = 'start' | 'end' | 'center' | 'stretch';

export type ContentAlignment = ItemsAlignment | 'space-around' | 'space-between' | 'space-evenly';
export interface GridProps {
  children: NonNullable<React.ReactNode>;
  display?: 'grid' | 'inline-grid';
  gap?: ThemeSpacingTokens;
  templateColumns?: string;
  templateRows?: string;
  justifyContent?: ContentAlignment;
  alignContent?: ContentAlignment;
  justifyItems?: ItemsAlignment;
  alignItems?: ItemsAlignment;
  autoFlow?: 'row' | 'column' | 'row dense' | 'column dense';
}

export interface GridItemProps {
  children: NonNullable<React.ReactNode>;
  columnStart?: string;
  columnEnd?: number | `span ${number}`;
  rowStart?: string;
  rowEnd?: number | `span ${number}`;
}

export const Grid = ({
  children,
  display = 'grid',
  gap = 1,
  templateColumns = 'none',
  templateRows = 'none',
  autoFlow = 'row',
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
}: GridProps & GridItemProps) => {
  const styles = useStyles2(
    useCallback(
      (theme) =>
        getStyles(
          theme,
          display,
          gap,
          templateColumns,
          templateRows,
          autoFlow,
          columnStart,
          columnEnd,
          rowStart,
          rowEnd,
        ),
      [
        display,
        gap,
        templateColumns,
        templateRows,
        autoFlow,
        columnStart,
        columnEnd,
        rowStart,
        rowEnd,
      ]
    )
  );

  const childrenWithProps = React.Children.map(children, (child) => {
    return child && React.cloneElement(child as React.ReactElement, { className: styles.gridItem });
  });

  return <div className={styles.grid}>{childrenWithProps}</div>;
};

Grid.displayName = 'Grid';

const getStyles = (
  theme: GrafanaTheme2,
  display: 'grid' | 'inline-grid',
  gap: ThemeSpacingTokens,
  templateColumns: GridProps['templateColumns'],
  templateRows: GridProps['templateRows'],
  autoFlow: GridProps['autoFlow'],
  columnStart?: GridItemProps['columnStart'],
  columnEnd?: GridItemProps['columnEnd'],
  rowStart?: GridItemProps['rowStart'],
  rowEnd?: GridItemProps['rowEnd'],
) => {
  return {
    grid: css({
      display,
      gap: theme.spacing(gap) ,
      gridTemplateColumns: templateColumns,
      gridTemplateRows: templateRows,
      justifyContent: 'center',
      alignContent: 'center',
      justifyItems: 'stretch',
      alignItems: 'stretch',
      gridAutoFlow: autoFlow,
    }),
    gridItem: css({
      gridColumnStart: columnStart,
      gridColumnEnd: columnEnd,
      gridRowStart: rowStart,
      gridRowEnd: rowEnd,
    }),
  };
};
