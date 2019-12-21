import { TextAlignProperty } from 'csstype';
import { ComponentType } from 'react';
import { Field } from '@grafana/data';

export interface FieldTableOptions {
  width: number;
  align: FieldTextAlignment;
}

export type FieldTextAlignment = 'auto' | 'left' | 'right' | 'center';

export interface TableColumn {
  // React table props
  Header: string;
  accessor: string | Function;
  Cell?: (props: ReactTableCellProps) => string | ComponentType<ReactTableCellProps>;
  // Grafana additions
  field: Field;
  width: number;
  textAlign: TextAlignProperty;
}

export interface TableRow {
  [x: string]: any;
}

export interface ReactTableCellProps {
  cell: ReactTableCell;
  column: TableColumn;
}

export interface ReactTableCell {
  value: any;
}
