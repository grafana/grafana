import { Column, Row, TableInstance } from 'react-table';

export interface TableProps {
  data: object[];
  columns: Column[];
  pendingRequest?: boolean;
  emptyMessage?: string;
  children?: (rows: Row[], table: TableInstance) => React.ReactNode;
}
