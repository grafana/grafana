import { Property } from 'csstype';
import { FC } from 'react';
import { CellProps, Column, Row, TableState, UseExpandedRowProps } from 'react-table';

import {
  DataFrame,
  Field,
  KeyValue,
  SelectableValue,
  TimeRange,
  FieldConfigSource,
  ActionModel,
  InterpolateFunction,
} from '@grafana/data';
import * as schema from '@grafana/schema';

import { TableStyles } from './styles';

export {
  type FieldTextAlignment,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  type TableAutoCellOptions,
  type TableSparklineCellOptions,
  type TableBarGaugeCellOptions,
  type TableColoredBackgroundCellOptions,
  type TableColorTextCellOptions,
  type TableImageCellOptions,
  type TableJsonViewCellOptions,
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
  frame: DataFrame;
  actions?: ActionModel[];
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
  // We manually track this to know where to reset the row heights. This is needed because react-table removed the
  // collapsed IDs/indexes from the state.expanded map so when collapsing we would have to do a diff of current and
  // previous state.expanded to know what changed.
  lastExpandedOrCollapsedIndex?: number;
}

export interface GrafanaTableRow extends Row, UseExpandedRowProps<{}> {}

export interface TableStateReducerProps {
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  data: DataFrame;
}

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
  initialSortBy?: TableSortByFieldState[];
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  onCellFilterAdded?: TableFilterActionCallback;
  footerOptions?: TableFooterCalc;
  footerValues?: FooterItem[];
  enablePagination?: boolean;
  cellHeight?: schema.TableCellHeight;
  /** @alpha Used by SparklineCell when provided */
  timeRange?: TimeRange;
  enableSharedCrosshair?: boolean;
  // The index of the field value that the table will initialize scrolled to
  initialRowIndex?: number;
  fieldConfig?: FieldConfigSource;
  getActions?: GetActionsFunction;
  replaceVariables?: InterpolateFunction;
}

/**
 * @alpha
 * Props that will be passed to the TableCustomCellOptions.cellComponent when rendered.
 */
export interface CustomCellRendererProps {
  field: Field;
  rowIndex: number;
  frame: DataFrame;
  // Would be great to have generic type for this but that would need having a generic DataFrame type where the field
  // types could be propagated here.
  value: unknown;
}

/**
 * @alpha
 * Can be used to define completely custom cell contents by providing a custom cellComponent.
 */
export interface TableCustomCellOptions {
  cellComponent: FC<CustomCellRendererProps>;
  type: schema.TableCellDisplayMode.Custom;
}

/**
 * @alpha
 * Props that will be passed to the TableCustomCellOptions.cellComponent when rendered.
 */
export interface CustomHeaderRendererProps {
  field: Field;
  defaultContent: React.ReactNode;
}

// As cue/schema cannot define function types (as main point of schema is to be serializable) we have to extend the
// types here with the dynamic API. This means right now this is not usable as a table panel option for example.
export type TableCellOptions = schema.TableCellOptions | TableCustomCellOptions;
export type TableFieldOptions = Omit<schema.TableFieldOptions, 'cellOptions'> & {
  cellOptions: TableCellOptions;
  headerComponent?: React.ComponentType<CustomHeaderRendererProps>;
};

// Cell background and text colors
// Can also be used for table rows
export interface CellColors {
  textColor?: string;
  bgColor?: string;
  bgHoverColor?: string;
}

export type GetActionsFunction = (
  frame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables?: InterpolateFunction
) => ActionModel[];
