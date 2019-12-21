import { TextAlignProperty } from 'csstype';
import { ComponentType } from 'react';
import { Field } from '@grafana/data';
import { TableStyles } from './styles';

export interface FieldTableOptions {
  width: number;
  align: FieldTextAlignment;
  displayMode: CellDisplayMode;
}

export enum CellDisplayMode {
  Auto = 'auto',
  ColorText = 'color-text',
  ColorBackground = 'color-background',
  BarGauge = 'bar-gauge',
}

export type FieldTextAlignment = 'auto' | 'left' | 'right' | 'center';

export interface TableColumn {
  // React table props
  Header: string;
  accessor: string | Function;
  Cell: ComponentType<ReactTableCellProps>;
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
  tableStyles: TableStyles;
}

export interface ReactTableCell {
  value: any;
}
