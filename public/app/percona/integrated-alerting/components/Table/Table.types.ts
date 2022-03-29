import {
  Column,
  TableInstance,
  TableState,
  Row,
  TableOptions,
  TableHeaderProps,
  TableRowProps,
  TableCellProps,
  Cell,
  ColumnInstance,
  HeaderGroup,
} from 'react-table';

export interface ExtendedTableRowProps extends TableRowProps {
  onClick?: () => void;
}

export interface ExtendedTableCellProps extends TableCellProps {
  onClick?: () => void;
}

export interface ExtendedTableHeaderProps extends TableHeaderProps {
  onClick?: () => void;
}

export interface TableProps {
  data: object[];
  columns: Array<Column<any>>;
  pendingRequest?: boolean;
  emptyMessage?: string;
  showPagination?: boolean;
  totalItems: number;
  totalPages?: number;
  tableHash?: string;
  pageSize?: number;
  pageIndex?: number;
  pagesPerView?: number;
  autoResetPage?: boolean;
  autoResetExpanded?: boolean;
  onPaginationChanged?: (pageSize: number, pageIndex: number) => void;
  children?: (rows: Row[], table: TableInstance) => React.ReactNode;
  renderExpandedRow?: (row: Row<any>) => React.ReactNode;
  getHeaderProps?: (column: HeaderGroup) => ExtendedTableHeaderProps;
  getRowProps?: (row: Row<any>) => ExtendedTableRowProps;
  getColumnProps?: (column: ColumnInstance) => ExtendedTableCellProps;
  getCellProps?: (cell: Cell<any, any>) => ExtendedTableCellProps;
}

export interface PaginatedTableState extends TableState {
  pageIndex: number;
  pageSize: number;
}

export interface PaginatedTableInstance extends TableInstance {
  page: Row[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  gotoPage: (page: number) => void;
  previousPage: () => void;
  nextPage: () => void;
  pageCount: number;
  setPageSize: (size: number) => void;
  state: PaginatedTableState;
}

export interface PaginatedTableOptions extends TableOptions<object> {
  manualPagination?: boolean;
  pageCount?: number;
  autoResetPage?: boolean;
  autoResetExpanded?: boolean;
}
