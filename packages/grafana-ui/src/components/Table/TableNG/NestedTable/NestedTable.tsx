import React from 'react';
import DataGrid, { SortColumn } from 'react-data-grid';

import { DataFrame } from '@grafana/data';

import { RowExpander } from '../Cells/RowExpander';
import { mapFrameToDataGrid } from '../TableNG';
import { COLUMN } from '../constants';
import { TableSortHandlers } from '../hooks';
import { ColumnTypes, TableSummaryRow, TableColumn, TableRow } from '../types';
import { frameToRecords, getComparator, MapFrameToGridOptions } from '../utils';

interface NestedTableProps {
  row: TableRow & { __depth: number; __index: number; data?: DataFrame };
  defaultRowHeight: number;
  onCellExpand: (rowIdx: number) => void;
  expandedRows: number[];
  onColumnResize: (col: string, width: number) => void;
  handleNestedTableSort: TableSortHandlers['handleNestedTableSort'];
  onSort: TableSortHandlers['onSort'];
  availableWidth: number;
  options: MapFrameToGridOptions;
  styles: { dataGrid: string };
  nestedTableSortColumns: Record<number, readonly SortColumn[]>;
  calcsRef: React.MutableRefObject<string[]>;
}

export const NestedTable = ({
  row,
  defaultRowHeight,
  onCellExpand,
  expandedRows,
  onColumnResize,
  handleNestedTableSort,
  onSort,
  availableWidth,
  options,
  styles,
  nestedTableSortColumns,
  calcsRef,
}: NestedTableProps) => {
  // TODO add TableRow type extension to include row depth and optional data
  if (Number(row.__depth) === 0) {
    const rowIdx = Number(row.__index);
    return (
      <RowExpander
        height={defaultRowHeight}
        onCellExpand={() => onCellExpand(rowIdx)}
        isExpanded={expandedRows.includes(rowIdx)}
      />
    );
  }
  // If it's a child, render entire DataGrid at first column position
  let expandedColumns: TableColumn[] = [];
  let expandedRecords: TableRow[] = [];
  const nestedRowIdx = Number(row.__index);

  // Create a wrapper for onSort that always sets hasNestedFrames=true
  const nestedOnSort = (columnKey: string, direction: SortColumn['direction'], isMultiSort: boolean) => {
    onSort(columnKey, direction, isMultiSort, nestedRowIdx, true);
  };

  // Type guard to check if data exists as it's optional
  if (row.data) {
    expandedColumns = mapFrameToDataGrid({
      frame: row.data,
      calcsRef,
      options: { ...options },
      handlers: {
        onCellExpand,
        onColumnResize,
        handleNestedTableSort,
        onSort: nestedOnSort, // Use our wrapped version that enforces hasNestedFrames=true
      },
      availableWidth,
      parentRowIdx: nestedRowIdx,
    });
    expandedRecords = frameToRecords(row.data);
  }

  // Get sort columns for this nested table
  const nestedSortColumns = nestedTableSortColumns?.[nestedRowIdx] || [];

  // Sort the nested table rows if we have sort columns
  let nestedRows = expandedRecords;
  if (nestedSortColumns.length > 0 && row.data) {
    // Extract column types from nested frame
    const nestedColumnTypes = row.data.fields.reduce<ColumnTypes>(
      (acc, { name, type }) => ({ ...acc, [name]: type }),
      {}
    );

    // Sort nested rows
    nestedRows = [...expandedRecords].sort((a, b) => {
      let result = 0;
      for (let i = 0; i < nestedSortColumns.length; i++) {
        const { columnKey, direction } = nestedSortColumns[i];
        const compare = getComparator(nestedColumnTypes[columnKey]);
        const sortDir = direction === 'ASC' ? 1 : -1;

        result = sortDir * compare(a[columnKey], b[columnKey]);
        if (result !== 0) {
          break;
        }
      }
      return result;
    });
  }

  return (
    <DataGrid<TableRow, TableSummaryRow>
      rows={nestedRows}
      columns={expandedColumns}
      rowHeight={defaultRowHeight}
      className={styles.dataGrid}
      style={{ height: '100%', overflow: 'visible', marginLeft: COLUMN.EXPANDER_WIDTH - 1 }}
      headerRowHeight={row.data?.meta?.custom?.noHeader ? 0 : undefined}
      defaultColumnOptions={{ sortable: true, resizable: true }}
      sortColumns={nestedSortColumns}
      onSortColumnsChange={(sortColumns) => handleNestedTableSort(nestedRowIdx, sortColumns)}
    />
  );
};
