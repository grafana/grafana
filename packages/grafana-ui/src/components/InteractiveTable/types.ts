import { type RowData } from '@tanstack/react-table';
import { type ReactNode } from 'react';

/**
 * Props passed to a custom cell renderer.
 *
 * This is a Grafana-owned contract. `value` and `cell.value` are compatibility aliases for the
 * equivalent react-table v7 properties; other v7 table-instance properties are not available.
 */
export interface InteractiveTableRow<TableData extends object> {
  original: TableData;
  id: string;
  index: number;
  getIsExpanded: () => boolean;
  getToggleExpandedHandler: () => (event?: unknown) => void;
}

export interface InteractiveTableMeta {
  getRowHTMLID?: (rowId: string) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` keeps cell renderers typed for a specific value assignable, as in react-table v7
export type CellProps<TableData extends object, Value = any> = {
  row: InteractiveTableRow<TableData>;
  cell: { value: Value };
  value: Value;
  table: {
    options: {
      meta?: InteractiveTableMeta;
    };
  };
};

export type HeaderProps<TableData extends object> = {
  table: {
    getIsAllRowsExpanded: () => boolean;
    toggleAllRowsExpanded: (expanded?: boolean) => void;
  };
};

/** Custom sorting function. Only `original` is part of the public contract. */
export type SortByFn<TableData extends object> = (
  rowA: { original: TableData },
  rowB: { original: TableData },
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

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    getRowHTMLID?: (rowId: string) => string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    visible?: (data: TData[]) => boolean;
    widthClass?: string;
  }
}
