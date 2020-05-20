import { CellProps } from 'react-table';
import { Field } from '@grafana/data';
import { TableStyles } from './styles';
import { FC } from 'react';

export interface TableFieldOptions {
  width: number;
  align: FieldTextAlignment;
  displayMode: TableCellDisplayMode;
  hidden?: boolean;
}

export enum TableCellDisplayMode {
  Auto = 'auto',
  ColorText = 'color-text',
  ColorBackground = 'color-background',
  GradientGauge = 'gradient-gauge',
  LcdGauge = 'lcd-gauge',
  JSONView = 'json-view',
}

export type FieldTextAlignment = 'auto' | 'left' | 'right' | 'center';

export interface TableRow {
  [x: string]: any;
}

export type TableFilterActionCallback = (key: string, value: string) => void;
export type TableColumnResizeActionCallback = (fieldDisplayName: string, width: number) => void;
export type TableSortByActionCallback = (state: TableSortByFieldState[]) => void;

export interface TableSortByFieldState {
  displayName: string;
  desc?: boolean;
}

export interface TableCellProps extends CellProps<any> {
  tableStyles: TableStyles;
  field: Field;
}

export type CellComponent = FC<TableCellProps>;
