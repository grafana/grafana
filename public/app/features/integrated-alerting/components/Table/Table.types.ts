import { Column } from 'react-table';

export interface TableProps {
  data: object[];
  columns: Column[];
  pendingRequest?: boolean;
  emptyMessage?: string;
}
