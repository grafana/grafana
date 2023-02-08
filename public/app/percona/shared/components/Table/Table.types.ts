import { TableProps as PerconaTableProps } from '@percona/platform-core';
import { Column } from 'react-table';

export interface TableProps<T extends object> extends Omit<PerconaTableProps, 'columns'> {
  columns: Array<Column<T>>;
  style?: string;
}
