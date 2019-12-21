import { TextAlignProperty } from 'csstype';
import { ComponentType } from 'react';
import { Field } from '@grafana/data';
import { TableStyles } from './styles';

export interface TableFieldOptions {
  width: number;
  align: FieldTextAlignment;
  displayMode: TableCellDisplayMode;
}

export enum TableCellDisplayMode {
  Auto = 'auto',
  ColorText = 'color-text',
  ColorBackground = 'color-background',
  GradientGauge = 'gradient-gauge',
  LcdGauge = 'lcd-gauge',
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
