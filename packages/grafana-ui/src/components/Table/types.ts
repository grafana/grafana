import { Property } from 'csstype';
import { FC } from 'react';
import { CellProps, Column, Row, TableState, UseExpandedRowProps } from 'react-table';

import { DataFrame, Field, KeyValue, SelectableValue } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { TableStyles } from './styles';

export {
  type TableFieldOptions,
  TableCellDisplayMode,
  type FieldTextAlignment,
  TableCellBackgroundDisplayMode,
} from '@grafana/schema';

export interface TableRow {
  [x: string]: any;
}

export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';
export type AdHocFilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type AdHocFilterItem = { key: string; value: string; operator: AdHocFilterOperator };
export type TableFilterActionCallback = (item: AdHocFilterItem) => void;
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
  countRows?: boolean;
}

export interface GrafanaTableState extends TableState {
  lastExpandedIndex?: number;
  toggleRowExpandedCounter: number;
}

export interface GrafanaTableRow extends Row, UseExpandedRowProps<{}> {}

export interface Props {
  ariaLabel?: string;
  data: DataFrame;
  width: number;
  height: number;
  maxHeight?: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  showTypeIcons?: boolean;
  resizable?: boolean;
  showRowNums?: boolean;
  initialSortBy?: TableSortByFieldState[];
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  onCellFilterAdded?: TableFilterActionCallback;
  footerOptions?: TableFooterCalc;
  footerValues?: FooterItem[];
  enablePagination?: boolean;
  cellHeight?: TableCellHeight;
  /** @alpha */
  subData?: DataFrame[];
}
