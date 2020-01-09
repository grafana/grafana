import { TableStyles } from './styles';
import { CellProps } from 'react-table';
import { Field } from '@grafana/data';

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

export interface TableRow {
  [x: string]: any;
}

export type TableFilterActionCallback = (key: string, value: string) => void;

export interface ReactTableCellProps extends CellProps<any> {
  // cell: ReactTableCell;
  // column: Column;
  tableStyles: TableStyles;
  field: Field;
}

export interface ReactTableCell {
  value: any;
}
