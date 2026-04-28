import { type ReactNode } from 'react';
import {
  type CellProps,
  type DefaultSortTypes,
  type HeaderProps,
  type IdType,
  type Renderer,
  type SortByFn,
} from 'react-table';

export interface Column<TableData extends object> {
  /**
   * ID of the column. Must be unique among all other columns
   */
  id: IdType<TableData>;
  /**
   * Custom render function for te cell
   */
  cell?: (props: CellProps<TableData>) => ReactNode;
  /**
   * Header name. Can be a string, renderer function, or undefined. If `undefined` the header will be empty. Useful for action columns.
   */
  header?: Renderer<HeaderProps<TableData>>;
  /**
   * Column sort type. If `undefined` the column will not be sortable.
   * */
  sortType?: DefaultSortTypes | SortByFn<TableData>;
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
