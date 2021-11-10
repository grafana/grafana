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

export interface TableProps {
  data: object[];
  columns: Column[];
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
  getHeaderProps?: (column: HeaderGroup) => TableHeaderProps;
  getRowProps?: (row: Row<any>) => TableRowProps;
  getColumnProps?: (column: ColumnInstance) => TableCellProps;
  getCellProps?: (cell: Cell<any, any>) => TableCellProps;
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
