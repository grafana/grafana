import { ReactNode } from 'react';
import { CellProps, DefaultSortTypes, IdType, SortByFn } from 'react-table';

export interface Column<TableData extends object> {
  /**
   * ID of the column.
   * Set this to the matching object key of your data or `undefined` if the column doesn't have any associated data with it.
   * This must be unique among all other columns.
   */
  id?: IdType<TableData>;
  cell?: (props: CellProps<TableData>) => ReactNode;
  header?: string;
  sortType?: DefaultSortTypes | SortByFn<TableData>;
  shrink?: boolean;
  visible?: (col: TableData[]) => boolean;
}

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;
export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);
