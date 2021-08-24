import { CellProps } from 'react-table';
import { Field } from '@grafana/data';
import { TableStyles } from './styles';
import { CSSProperties, FC } from 'react';

export { TableFieldOptions, TableCellDisplayMode, FieldTextAlignment } from '@grafana/schema';

export interface TableRow {
  [x: string]: any;
}

export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';
export type FilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type FilterItem = { key: string; value: string; operator: FilterOperator };
export type TableFilterActionCallback = (item: FilterItem) => void;
export type TableColumnResizeActionCallback = (fieldDisplayName: string, width: number) => void;
export type TableSortByActionCallback = (state: TableSortByFieldState[]) => void;

export interface TableSortByFieldState {
  displayName: string;
  desc?: boolean;
}

export interface TableCellProps extends CellProps<any> {
  tableStyles: TableStyles;
  cellProps: CSSProperties;
  field: Field;
  onCellFilterAdded: TableFilterActionCallback;
  innerWidth: number;
}

export type CellComponent = FC<TableCellProps>;
