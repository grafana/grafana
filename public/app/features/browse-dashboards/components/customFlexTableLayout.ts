import { type Column } from '@tanstack/react-table';

/**
 * Simplified flex layout helpers for TanStack Table.
 * Uses the width of the column as the flex grow amount - the ratio of width between all columns
 *
 * Width of 0 for 'auto' width - useful for columns of fixed with that should shrink to the size
 * of content
 *
 * Originally based on https://github.com/TanStack/table/blob/v7/src/plugin-hooks/useFlexLayout.js
 */
export function getColumnFlexStyle<D>(column: Column<D>) {
  const size = column.columnDef.size;
  return {
    flex:
      size === 0
        ? // if size: 0, prevent the column from growing (or shrinking), and set basis to auto to
          // fit column to the width of its content
          '0 0 auto'
        : // Otherwise, grow the content to a size in proportion to the other column sizes
          `${size ?? column.getSize()} 0 0`,
  };
}

export function getFlexRowStyle() {
  return {
    display: 'flex',
    flex: '1 0 auto',
  };
}
