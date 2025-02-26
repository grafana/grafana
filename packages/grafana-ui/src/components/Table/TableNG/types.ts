import { Property } from 'csstype';

import {
  DataFrame,
  Field,
  GrafanaTheme2,
  KeyValue,
  TimeRange,
  FieldConfigSource,
  ActionModel,
  InterpolateFunction,
} from '@grafana/data';
import { TableCellOptions, TableCellHeight, TableFieldOptions } from '@grafana/schema';

export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';

export type AdHocFilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type AdHocFilterItem = { key: string; value: string; operator: AdHocFilterOperator };
export type TableFilterActionCallback = (item: AdHocFilterItem) => void;
export type TableColumnResizeActionCallback = (fieldDisplayName: string, width: number) => void;
export type TableSortByActionCallback = (state: TableSortByFieldState[]) => void;
export type FooterItem = Array<KeyValue<string>> | string | undefined;

export type GetActionsFunction = (
  frame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables?: InterpolateFunction
) => ActionModel[];

export type TableFieldOptionsType = Omit<TableFieldOptions, 'cellOptions'> & {
  cellOptions: TableCellOptions;
  headerComponent?: React.ComponentType<CustomHeaderRendererProps>;
};

export type FilterType = {
  [key: string]: {
    filteredSet: Set<string>;
  };
};

export type TableRow = Record<string, unknown>;

export interface CustomHeaderRendererProps {
  field: Field;
  defaultContent: React.ReactNode;
}

export interface TableSortByFieldState {
  displayName: string;
  desc?: boolean;
}

export interface TableFooterCalc {
  show: boolean;
  reducer: string[]; // actually 1 value
  fields?: string[];
  enablePagination?: boolean;
  countRows?: boolean;
}

// export interface Props {
export interface BaseTableProps {
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
  cellHeight?: TableCellHeight;
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
 * Props for the react-data-grid based table.
 */
export interface TableNGProps extends BaseTableProps {}

export interface CellNGProps {
  value: any;
  field: Field;
  theme?: GrafanaTheme2;
  height?: number;
  justifyContent: Property.JustifyContent;
  rowIdx?: number;
}

export interface RowExpanderNGProps {
  height: number;
  onCellExpand: () => void;
  isExpanded?: boolean;
}

export interface BarGaugeCellProps extends CellNGProps {
  height: number;
  theme: GrafanaTheme2;
  timeRange: TimeRange;
  width: number;
}

export interface ImageCellProps extends CellNGProps {
  cellOptions: TableCellOptions;
  height: number;
}

export interface ActionCellProps {
  actions?: ActionModel[];
}

export interface SparklineCellProps extends BarGaugeCellProps {}

export interface CellColors {
  textColor?: string;
  bgColor?: string;
  bgHoverColor?: string;
}
