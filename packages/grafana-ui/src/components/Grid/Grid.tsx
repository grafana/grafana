import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export type ItemsAlignment = 'start' | 'end' | 'center' | 'stretch';

export type ContentAlignment = ItemsAlignment | 'space-around' | 'space-between' | 'space-evenly';

export interface GridProps {
  children: NonNullable<React.ReactNode>;
  display?: 'grid' | 'inline-grid';
  gap?: string;
  templateColumns?: string;
  templateRows?: string;
  justifyContent?: ContentAlignment;
  alignContent?: ContentAlignment;
  justifyItems?: ItemsAlignment;
  alignItems?: ItemsAlignment;
  autoColumns?: string;
  autoRows?: string;
  autoFlow?: string;
}

export interface GridItemProps {
  children: NonNullable<React.ReactNode>;
  columnStart?: string;
  columnEnd?: string;
  rowStart?: string;
  rowEnd?: string;
  justifySelf?: ItemsAlignment;
  alignSelf?: ItemsAlignment;
}

export const Grid = ({
  children,
  display = 'grid',
  gap,
  templateColumns = 'none',
  templateRows = 'none',
  justifyContent = 'center',
  alignContent = 'center',
  justifyItems = 'stretch',
  alignItems = 'stretch',
  autoColumns = 'auto',
  autoRows = 'auto',
  autoFlow = 'row',
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
  justifySelf,
  alignSelf,
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
          justifyContent,
          alignContent,
          justifyItems,
          alignItems,
          autoColumns,
          autoRows,
          autoFlow,
          columnStart,
          columnEnd,
          rowStart,
          rowEnd,
          justifySelf,
          alignSelf
        ),
      [
        display,
        gap,
        templateColumns,
        templateRows,
        justifyContent,
        alignContent,
        justifyItems,
        alignItems,
        autoColumns,
        autoRows,
        autoFlow,
        columnStart,
        columnEnd,
        rowStart,
        rowEnd,
        justifySelf,
        alignSelf,
      ]
    )
  );

  const childrenWithProps = React.Children.map(children, (child) => {
    return child && <div className={styles.gridItem}>{child}</div>;
  });

  return <div className={styles.grid}>{childrenWithProps}</div>;
};

Grid.displayName = 'Grid';

const getStyles = (
  theme: GrafanaTheme2,
  display: 'grid' | 'inline-grid',
  gap: string = theme.spacing(1),
  templateColumns: string,
  templateRows: string,
  justifyContent: ContentAlignment,
  alignContent: ContentAlignment,
  justifyItems: ItemsAlignment,
  alignItems: ItemsAlignment,
  autoColumns: string,
  autoRows: string,
  autoFlow: string,
  columnStart?: string,
  columnEnd?: string,
  rowStart?: string,
  rowEnd?: string,
  justifySelf?: ItemsAlignment,
  alignSelf?: ItemsAlignment
) => {
  return {
    grid: css({
      display,
      gap,
      gridTemplateColumns: templateColumns,
      gridTemplateRows: templateRows,
      justifyContent,
      alignContent,
      justifyItems,
      alignItems,
      gridAutoColumns: autoColumns,
      gridAutoRows: autoRows,
      gridAutoFlow: autoFlow,
    }),
    gridItem: css({
      display: 'contents',
      gridColumnStart: columnStart,
      gridColumnEnd: columnEnd,
      gridRowStart: rowStart,
      gridRowEnd: rowEnd,
      justifySelf,
      alignSelf,
    }),
  };
};
