import { type FC } from 'react';

import { type DataFrame, type Field, type ActionModel, type InterpolateFunction } from '@grafana/data';
import type * as schema from '@grafana/schema';

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
