import {
  type Cell,
  type CellContext,
  type ColumnDef,
  type Row,
  type RowData,
  type TableState,
} from '@tanstack/react-table';
import { type Property } from 'csstype';
import { type FC } from 'react';

import {
  type DataFrame,
  type Field,
  type KeyValue,
  type TimeRange,
  type FieldConfigSource,
  type ActionModel,
  type InterpolateFunction,
} from '@grafana/data';
import type * as schema from '@grafana/schema';

import { type TableCellInspectorMode } from './TableCellInspector';
import { type TableStyles } from './TableRT/styles';

export {
  TableCellDisplayMode,
  type TableAutoCellOptions,
  type TableSparklineCellOptions,
  type TableBarGaugeCellOptions,
  type TableColoredBackgroundCellOptions,
  type TableColorTextCellOptions,
  type TableImageCellOptions,
  type TableJsonViewCellOptions,
} from '@grafana/schema';

export type InspectCell = { value: any; mode: TableCellInspectorMode };

export const FILTER_FOR_OPERATOR = '=';
export const FILTER_OUT_OPERATOR = '!=';
type AdHocFilterOperator = typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR;
export type AdHocFilterItem = { key: string; value: string; operator: AdHocFilterOperator };
export type TableFilterActionCallback = (item: AdHocFilterItem) => void;
export type TableColumnResizeActionCallback = (
  fieldDisplayName: string,
  width: number,
  fieldScope?: schema.MatcherScope
) => void;
type TableSortByActionCallback = (state: TableSortByFieldState[]) => void;
export type TableInspectCellCallback = (state: InspectCell) => void;

export interface TableSortByFieldState {
  displayName: string;
  desc?: boolean;
}

/** Link props the table implementation can pass down to its cell renderers. */
export interface TableCellUserProps {
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Props passed to a cell renderer. TanStack Table only passes its own `CellContext`, the rest of the props
 * are added by `TableCell` when it renders the cell.
 */
export interface TableCellProps extends Omit<CellContext<unknown, unknown>, 'cell'> {
  cell: Cell<unknown, unknown> & { value: any };
  tableStyles: TableStyles;
  cellProps: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
  field: Field;
  onCellFilterAdded?: TableFilterActionCallback;
  innerWidth: number;
  frame: DataFrame;
  actions?: ActionModel[]; // unused in NG
  setInspectCell?: TableInspectCellCallback;
  timeRange?: TimeRange;
  userProps?: TableCellUserProps;
  rowStyled?: boolean;
  rowExpanded?: boolean;
  textWrapped?: boolean;
  height?: number;
  showFilters?: boolean;
}

export type CellComponent = FC<TableCellProps>;

export type FooterItem = Array<KeyValue<string>> | string | undefined;

export interface GrafanaColumnMeta {
  field: Field;
  justifyContent: Property.JustifyContent;
  /** Renderer for the cells of this column. It is rendered by `TableCell`, which adds the Grafana specific props. */
  cellComponent: CellComponent;
}

declare module '@tanstack/react-table' {
  // Grafana specific column configuration. TanStack Table only passes `meta` through, it never reads it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    field?: Field;
    justifyContent?: Property.JustifyContent;
    cellComponent?: CellComponent;
  }
}

export type GrafanaTableColumn = ColumnDef<unknown, unknown> & {
  id: string;
  minSize: number;
  meta: GrafanaColumnMeta;
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

export type GrafanaTableRow = Row<unknown>;

export interface TableStateReducerProps {
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  data: DataFrame;
}

// export interface Props {
export interface TableRTProps {
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
  headerTooltip?: string;
  /** Controls whether this column can be resized. */
  resizable?: boolean;
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
