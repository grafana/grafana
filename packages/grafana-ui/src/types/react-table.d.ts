import {
  UseColumnOrderInstanceProps,
  UseColumnOrderState,
  UseExpandedInstanceProps,
  UseExpandedOptions,
  UseExpandedRowProps,
  UseExpandedState,
  UseFiltersColumnOptions,
  UseFiltersColumnProps,
  UseFiltersInstanceProps,
  UseFiltersOptions,
  UseFiltersState,
  UseGroupByCellProps,
  UseGroupByColumnOptions,
  UseGroupByColumnProps,
  UseGroupByInstanceProps,
  UseGroupByOptions,
  UseGroupByRowProps,
  UseGroupByState,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
  UseResizeColumnsColumnOptions,
  UseResizeColumnsHeaderProps,
  UseResizeColumnsOptions,
  UseRowSelectInstanceProps,
  UseRowSelectOptions,
  UseRowSelectRowProps,
  UseRowSelectState,
  UseRowStateCellProps,
  UseRowStateInstanceProps,
  UseRowStateRowProps,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
  UseTableCellProps,
  UseTable,
} from 'react-table';

declare module 'react-table' {
  // take this file as-is, or comment out the sections that don't apply to your plugin configuration

  export interface TableOptions<D extends object>  // note that having Record here allows you to add anything to the options, this matches the spirit of the // UseResizeColumnsOptions<D>,
    extends // underlying js library, but might be cleaner if it's replaced by a more specific type that matches your
      // feature set, this is a safe default.
      // Record<string, any>,
      UseExpandedOptions<D>,
      UseFiltersOptions<D>,
      UseGroupByOptions<D>,
      UsePaginationOptions<D>,
      UseRowSelectOptions<D>,
      UseSortByOptions<D> {
    updateMyData: (rowIndex: number, columnId: string, value: any) => void;
  }

  export interface TableInstance<D extends object = {}>  // UseColumnOrderInstanceProps<D>,
    extends UseExpandedInstanceProps<D>,
      UseFiltersInstanceProps<D>,
      UseGroupByInstanceProps<D>,
      UsePaginationInstanceProps<D>,
      UseRowSelectInstanceProps<D>,
      // UseRowStateInstanceProps<D>,
      UseSortByInstanceProps<D> {
    editable: boolean;
  }

  export interface TableState<D extends object = {}>  // UseColumnOrderState<D>,
    extends UseExpandedState<D>,
      UseFiltersState<D>,
      UseGroupByState<D>,
      UsePaginationState<D>,
      UseRowSelectState<D>,
      UseSortByState<D> {}

  export interface Column<D extends object = {}>
    extends UseFiltersColumnOptions<D>,
      UseGroupByColumnOptions<D>,
      UseSortByColumnOptions<D> {} // UseResizeColumnsColumnOptions<D>

  export interface ColumnInstance<D extends object = {}>
    extends UseFiltersColumnProps<D>,
      UseGroupByColumnProps<D>,
      UseSortByColumnProps<D> {} // UseResizeColumnsHeaderProps<D>

  export interface Cell<D extends object = {}> extends UseGroupByCellProps<D> {} // UseRowStateCellProps<D>

  export interface Row<D extends object = {}>
    extends UseExpandedRowProps<D>,
      UseGroupByRowProps<D>,
      UseRowSelectRowProps<D> {} // UseRowStateRowProps<D>
}
