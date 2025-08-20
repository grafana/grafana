import { ReactNode, SyntheticEvent } from 'react';
import { CellRendererProps, Column } from 'react-data-grid';

import {
  DataFrame,
  Field,
  GrafanaTheme2,
  KeyValue,
  TimeRange,
  FieldConfigSource,
  ActionModel,
  FieldType,
  DataFrameWithValue,
  SelectableValue,
} from '@grafana/data';
import { TableCellHeight, TableFieldOptions } from '@grafana/schema';

import { TableCellInspectorMode } from '../TableCellInspector';
import { TableCellOptions } from '../types';

import { TextAlign } from './utils';

export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';

export type AdHocFilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type AdHocFilterItem = { key: string; value: string; operator: AdHocFilterOperator };
export type TableFilterActionCallback = (item: AdHocFilterItem) => void;
export type TableColumnResizeActionCallback = (fieldDisplayName: string, width: number) => void;
export type TableSortByActionCallback = (state: TableSortByFieldState[]) => void;
export type FooterItem = Array<KeyValue<string>> | string | undefined;

export type GetActionsFunction = (frame: DataFrame, field: Field, rowIndex: number) => ActionModel[];

export type GetActionsFunctionLocal = (field: Field, rowIndex: number) => ActionModel[];

export type TableFieldOptionsType = Omit<TableFieldOptions, 'cellOptions'> & {
  cellOptions: TableCellOptions;
  headerComponent?: React.ComponentType<CustomHeaderRendererProps>;
};

export type FilterType = Record<
  string,
  {
    filteredSet: Set<string>;
    filtered?: Array<SelectableValue<unknown>>;
    searchFilter?: string;
    operator?: SelectableValue<string>;
  }
>;

/* ----------------------------- Table specific types ----------------------------- */
export interface TableSummaryRow {
  [columnName: string]: string | number | undefined;
}

export interface TableColumn extends Column<TableRow, TableSummaryRow> {
  field: Field; // Grafana field data/config
  width?: number | string; // Column width
  minWidth?: number; // Min width constraint
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
  __nestedFrames?: DataFrame[];
  __expanded?: boolean; // For row expansion state

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
  reducer?: string[];
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
  frozenColumns?: number;
  enablePagination?: boolean;
  cellHeight?: TableCellHeight;
  structureRev?: number;
  transparent?: boolean;
  /** @alpha Used by SparklineCell when provided */
  timeRange?: TimeRange;
  enableSharedCrosshair?: boolean;
  // The index of the field value that the table will initialize scrolled to
  initialRowIndex?: number;
  fieldConfig?: FieldConfigSource;
  getActions?: GetActionsFunction;
  // Used solely for testing as RTL can't correctly render the table otherwise
  enableVirtualization?: boolean;
  // for MarkdownCell, this flag disables sanitization of HTML content. Configured via config.ini.
  disableSanitizeHtml?: boolean;
}

/* ---------------------------- Table cell props ---------------------------- */
export interface TableNGProps extends BaseTableProps {}

export type TableCellRenderer = (props: TableCellRendererProps) => ReactNode;

export interface TableCellRendererProps {
  rowIdx: number;
  frame: DataFrame;
  timeRange?: TimeRange;
  value: TableCellValue;
  height: number;
  // flags that are static per column
  field: Field;
  cellOptions: TableCellOptions;
  width: number;
  theme: GrafanaTheme2;
  cellInspect: boolean;
  showFilters: boolean;
  getActions?: GetActionsFunctionLocal;
  disableSanitizeHtml?: boolean;
}

export type InspectCellProps = {
  rowIdx?: number;
  value: string;
  mode?: TableCellInspectorMode.code | TableCellInspectorMode.text;
};

export interface TableCellActionsProps {
  field: Field;
  value: TableCellValue;
  cellOptions: TableCellOptions;
  displayName: string;
  cellInspect: boolean;
  showFilters: boolean;
  setInspectCell: React.Dispatch<React.SetStateAction<InspectCellProps | null>>;
  className?: string;
  onCellFilterAdded?: TableFilterActionCallback;
}

/* ------------------------- Specialized Cell Props ------------------------- */
export interface RowExpanderNGProps {
  onCellExpand: (e: SyntheticEvent) => void;
  isExpanded?: boolean;
}

export interface SparklineCellProps {
  field: Field;
  rowIdx: number;
  theme: GrafanaTheme2;
  timeRange?: TimeRange;
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
}

export interface ImageCellProps {
  cellOptions: TableCellOptions;
  field: Field;
  value: TableCellValue;
  rowIdx: number;
}

export interface DataLinksCellProps {
  field: Field;
  rowIdx: number;
}

export interface GeoCellProps {
  value: TableCellValue;
  height: number;
}

export interface AutoCellProps {
  field: Field;
  value: TableCellValue;
  rowIdx: number;
}

export interface MarkdownCellProps {
  field: Field;
  rowIdx: number;
  disableSanitizeHtml?: boolean;
}

export interface ActionCellProps {
  field: Field;
  rowIdx: number;
  getActions: GetActionsFunctionLocal;
}

export interface PillCellProps {
  theme: GrafanaTheme2;
  field: Field;
  rowIdx: number;
}

export interface TableCellStyleOptions {
  textWrap: boolean;
  textAlign: TextAlign;
  shouldOverflow: boolean;
}

export type TableCellStyles = (theme: GrafanaTheme2, options: TableCellStyleOptions) => string;

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

export interface TypographyCtx {
  ctx: CanvasRenderingContext2D;
  fontFamily: string;
  letterSpacing: number;
  avgCharWidth: number;
  estimateLines: LineCounter;
  wrappedCount: LineCounter;
}

export type LineCounter = (value: unknown, width: number, field: Field, rowIdx: number) => number;
export interface LineCounterEntry {
  /**
   * given a values and the available width, returns the line count for that value
   */
  counter: LineCounter;
  /**
   * if getting an accurate line count is expensive, you can provide an estimate method
   * which will be used when looping over the row. the counter method will only be invoked
   * for the cell which is the maximum line count for the row.
   */
  estimate?: LineCounter;
  /**
   * indicates which field indexes of the visible fields this line counter applies to.
   */
  fieldIdxs: number[];
}

export type CellRootRenderer = (key: React.Key, props: CellRendererProps<TableRow, TableSummaryRow>) => React.ReactNode;

export interface FromFieldsResult {
  columns: TableColumn[];
  cellRootRenderers: Record<string, CellRootRenderer>;
  colsWithTooltip: Record<string, boolean>;
}
