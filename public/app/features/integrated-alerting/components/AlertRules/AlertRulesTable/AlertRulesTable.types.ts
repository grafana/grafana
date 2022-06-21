import { Column } from 'react-table';

export interface AlertRulesTableProps {
  data: object[];
  columns: Column[];
  pendingRequest?: boolean;
  emptyMessage?: string;
}
