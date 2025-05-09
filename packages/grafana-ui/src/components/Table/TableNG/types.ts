import { Property } from 'csstype';
import { Column } from 'react-data-grid';

import {
  DataFrame,
  Field,
  GrafanaTheme2,
  KeyValue,
  TimeRange,
  FieldConfigSource,
  ActionModel,
  InterpolateFunction,
  FieldType,
  DataFrameWithValue,
} from '@grafana/data';
import { TableCellOptions, TableCellHeight, TableFieldOptions } from '@grafana/schema';

import { TableCellInspectorMode } from '../TableCellInspector';

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

/* ----------------------------- Table specific types ----------------------------- */
export interface TableSummaryRow {
  [columnName: string]: string | number | undefined;
}

export interface TableColumn extends Column<TableRow, TableSummaryRow> {
  key: string; // Unique identifier used by DataGrid
  name: string; // Display name in header
  field: Field; // Grafana field data/config
  width?: number | string; // Column width
  minWidth?: number; // Min width constraint
  cellClass?: string; // CSS styling
}

// Possible values for table cells based on field types
export type TableCellValue =
  | string // FieldType.string, FieldType.enum
  | number // FieldType.number
  | boolean // FieldType.boolean
  | Date // FieldType.time
  | DataFrame // For nested data
  | DataFrame[] // For nested frames
  | DataFrameWithValue // For sparklines
  | undefined; // For undefined values

export interface TableRow {
  // Required metadata properties
  __depth: number;
  __index: number;

  // Nested table properties
  data?: DataFrame;
  'Nested frames'?: DataFrame[];

  // Generic typing for column values
  [columnName: string]: TableCellValue;
}

export interface CustomCellRendererProps {
  field: Field;
  rowIndex: number;
  frame: DataFrame;
  // Would be great to have generic type for this but that would need having a generic DataFrame type where the field
  // types could be propagated here.
  value: unknown;
}

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
  reducer?: string[]; // Make this optional
  fields?: string[];
  enablePagination?: boolean;
  countRows?: boolean;
}

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
  // Used solely for testing as RTL can't correctly render the table otherwise
  enableVirtualization?: boolean;
}

/* ---------------------------- Table cell props ---------------------------- */
export interface TableNGProps extends BaseTableProps {}

export interface TableCellNGProps {
  field: Field;
  frame: DataFrame;
  getActions?: GetActionsFunction;
  height: number;
  justifyContent: Property.JustifyContent;
  rowIdx: number;
  setContextMenuProps: (props: { value: string; top?: number; left?: number; mode?: TableCellInspectorMode }) => void;
  setIsInspecting: (isInspecting: boolean) => void;
  shouldTextOverflow: () => boolean;
  theme: GrafanaTheme2;
  timeRange: TimeRange;
  value: TableCellValue;
  rowBg: Function | undefined;
  onCellFilterAdded?: TableFilterActionCallback;
  replaceVariables?: InterpolateFunction;
}

/* ------------------------- Specialized Cell Props ------------------------- */
export interface RowExpanderNGProps {
  height: number;
  onCellExpand: () => void;
  isExpanded?: boolean;
}

export interface SparklineCellProps {
  field: Field;
  justifyContent: Property.JustifyContent;
  rowIdx: number;
  theme: GrafanaTheme2;
  timeRange: TimeRange;
  value: TableCellValue;
  width: number;
}

export interface BarGaugeCellProps {
  field: Field;
  height: number;
  rowIdx: number;
  theme: GrafanaTheme2;
  value: TableCellValue;
  width: number;
  timeRange: TimeRange;
}

export interface ImageCellProps {
  cellOptions: TableCellOptions;
  field: Field;
  height: number;
  justifyContent: Property.JustifyContent;
  value: TableCellValue;
  rowIdx: number;
}

export interface JSONCellProps {
  justifyContent: Property.JustifyContent;
  value: TableCellValue;
  field: Field;
  rowIdx: number;
}

export interface DataLinksCellProps {
  field: Field;
  rowIdx: number;
}

export interface GeoCellProps {
  value: TableCellValue;
  justifyContent: Property.JustifyContent;
  height: number;
}

export interface ActionCellProps {
  actions?: ActionModel[];
}

export interface CellColors {
  textColor?: string;
  bgColor?: string;
  bgHoverColor?: string;
}

export interface AutoCellProps {
  value: TableCellValue;
  field: Field;
  justifyContent: Property.JustifyContent;
  rowIdx: number;
  cellOptions: TableCellOptions;
}

// Comparator for sorting table values
export type Comparator = (a: TableCellValue, b: TableCellValue) => number;

// Type for converting a DataFrame into an array of TableRows
export type FrameToRowsConverter = (frame: DataFrame) => TableRow[];

// Type for mapping column names to their field types
export type ColumnTypes = Record<string, FieldType>;

export interface ScrollPosition {
  x: number;
  y: number;
}
