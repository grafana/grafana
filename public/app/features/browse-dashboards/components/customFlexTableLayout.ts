import { Hooks, UseTableColumnProps } from 'react-table';

/**
 * Simplified flex layout module for react-table.
 * Uses the width of the column as the flex grow amount - the ratio of width between all columns
 *
 * Width of 0 for 'auto' width - useful for columns of fixed with that should shrink to the size
 * of content
 *
 * Originally based on https://github.com/TanStack/table/blob/v7/src/plugin-hooks/useFlexLayout.js
 */
export function useCustomFlexLayout<D extends object>(hooks: Hooks<D>) {
  hooks.getRowProps.push((props) => [props, getRowStyles()]);
  hooks.getHeaderGroupProps.push((props) => [props, getRowStyles()]);
  hooks.getFooterGroupProps.push((props) => [props, getRowStyles()]);
  hooks.getHeaderProps.push((props, { column }) => [props, getColumnStyleProps(column)]);
  hooks.getCellProps.push((props, { cell }) => [props, getColumnStyleProps(cell.column)]);
  hooks.getFooterProps.push((props, { column }) => [props, getColumnStyleProps(column)]);
}

useCustomFlexLayout.pluginName = 'useCustomFlexLayout';

function getColumnStyleProps<D extends object>(column: UseTableColumnProps<D>) {
  return {
    style: {
      flex:
        column.totalWidth === 0
          ? // if width: 0, prevent the column from growing (or shrinking), and set basis to auto to
            // fit column to the width of its content
            '0 0 auto'
          : // Otherwise, grow the content to a size in proportion to the other column widths
            `${column.totalWidth} 0 0`,
    },
  };
}

function getRowStyles() {
  return {
    style: {
      display: 'flex',
      flex: '1 0 auto',
    },
  };
}
