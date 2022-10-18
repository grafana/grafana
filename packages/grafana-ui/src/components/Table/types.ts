import { Property } from 'csstype';
import { FC } from 'react';
import { CellProps, Column, Row } from 'react-table';

import { Field, KeyValue, SelectableValue } from '@grafana/data';

import { TableStyles } from './styles';

export { type TableFieldOptions, TableCellDisplayMode, type FieldTextAlignment } from '@grafana/schema';

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
  cellProps: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
  field: Field;
  onCellFilterAdded?: TableFilterActionCallback;
  innerWidth: number;
}

export type CellComponent = FC<TableCellProps>;

export type FooterItem = Array<KeyValue<string>> | string | undefined;

export type GrafanaTableColumn = Column & {
  field: Field;
  sortType: 'number' | 'basic' | 'alphanumeric-insensitive';
  filter: (rows: Row[], id: string, filterValues?: SelectableValue[]) => SelectableValue[];
  justifyContent: Property.JustifyContent;
  minWidth: number;
};

export interface TableFooterCalc {
  show: boolean;
  reducer: string[]; // actually 1 value
  fields?: string[];
  enablePagination?: boolean;
}
