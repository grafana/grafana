import { type ReactNode } from 'react';
import { type Cell, type CellContext, type HeaderContext, type Row } from '@tanstack/react-table';

export type CompatRow<TableData extends object> = Row<TableData> & {
  values: Record<string, unknown>;
};

export type CellProps<TableData extends object, Value = unknown> = Omit<
  CellContext<TableData, Value>,
  'cell' | 'row'
> & {
  cell: Cell<TableData, Value> & { value: Value };
  row: CompatRow<TableData>;
  value: Value;
  __rowID?: string;
};

export type HeaderProps<TableData extends object> = HeaderContext<TableData, unknown>;
export type SortByFn<TableData extends object> = (
  rowA: CompatRow<TableData>,
  rowB: CompatRow<TableData>,
  columnId: string
) => number;

export type InteractiveTableSortingFn = 'alphanumeric' | 'basic' | 'datetime' | 'number' | 'string';

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
  sortType?: InteractiveTableSortingFn | SortByFn<TableData>;
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
