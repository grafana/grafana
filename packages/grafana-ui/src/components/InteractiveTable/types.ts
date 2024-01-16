import { ReactNode } from 'react';
import { CellProps, DefaultSortTypes, IdType, SortByFn } from 'react-table';

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
   * Header name. if `undefined` the header will be empty. Useful for action columns.
   */
  header?: string;
  /**
   * Column sort type. If `undefined` the column will not be sortable.
   * */
  sortType?: DefaultSortTypes | SortByFn<TableData>;
  /**
   * If `true` prevents the column from growing more than its content.
   */
  disableGrow?: boolean;
  /**
   * If the provided function returns `false` the column will be hidden.
   */
  visible?: (data: TableData[]) => boolean;
}
