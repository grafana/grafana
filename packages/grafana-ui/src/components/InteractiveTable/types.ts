import { type Cell, type CellContext, type HeaderContext, type Row } from '@tanstack/react-table';
import { type ReactNode } from 'react';

/**
 * Props passed to a custom cell renderer. `value` and `cell.value` are kept from the react-table v7 API,
 * TanStack Table only provides `getValue()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` keeps cell renderers typed for a specific value assignable, as in react-table v7
export type CellProps<TableData extends object, Value = any> = Omit<CellContext<TableData, Value>, 'cell'> & {
  cell: Cell<TableData, Value> & { value: Value };
  value: Value;
  __rowID?: string;
};

export type HeaderProps<TableData extends object> = HeaderContext<TableData, unknown>;

export type SortByFn<TableData extends object> = (
  rowA: Row<TableData>,
  rowB: Row<TableData>,
  columnId: string
) => number;

export type SortType = 'alphanumeric' | 'basic' | 'datetime' | 'number' | 'string';

export interface Column<TableData extends object> {
  /**
   * ID of the column. Must be unique among all other columns
   */
  id: string;
  /**
   * Custom render function for te cell
   */
  cell?: (props: CellProps<TableData>) => ReactNode;
  /**
   * Header name. Can be a string, renderer function, or undefined. If `undefined` the header will be empty. Useful for action columns.
   */
  header?: ReactNode | ((props: HeaderProps<TableData>) => ReactNode);
  /**
   * Column sort type. If `undefined` the column will not be sortable.
   * */
  sortType?: SortType | SortByFn<TableData>;
  /**
   * If `true` prevents the column from growing more than its content. Ignored when `width` is set.
   */
  disableGrow?: boolean;
  /**
   * Fixed width for the column in pixels. Overrides flex-based sizing.
   */
  width?: number;
  /**
   * Minimum width for the column in pixels.
   */
  minWidth?: number;
  /**
   * Maximum width for the column in pixels.
   */
  maxWidth?: number;
  /**
   * If the provided function returns `false` the column will be hidden.
   */
  visible?: (data: TableData[]) => boolean;
  /**
   * Determines starting sort direction when the column header is clicked.
   */
  sortDescFirst?: boolean;
}
