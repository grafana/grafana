import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { useStyles2 } from '../../../themes';

export interface GridItemProps {
  children: NonNullable<React.ReactNode>;
  /** If set to 'false,' the grid item will inherit the parent's display property. If set to 'true,' the display property will be set to 'contents'. More info: https://developer.mozilla.org/en-US/docs/Web/CSS/display#display_contents */
  displayContents?: boolean;
  /** Specifies the column where the grid item starts within the grid */
  columnStart?: number;
  /** Specifies the column where the grid item ends.
    If its value is `span ${number}`, the item spans across the provided number of columns */
  columnEnd?: number | `span ${number}`;
  /** Specifies the row where the grid item starts within the grid */
  rowStart?: number;
  /** Specifies the row where the grid item ends */
  rowEnd?: number | `span ${number}`;
}

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
