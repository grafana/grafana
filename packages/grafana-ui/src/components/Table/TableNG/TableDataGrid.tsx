import 'react-data-grid/lib/styles.css';

import { clsx } from 'clsx';
import { type Dispatch, type RefObject, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { DataGrid, type DataGridHandle, type DataGridProps, type SortColumn } from 'react-data-grid';

import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Pagination } from '../../Pagination/Pagination';
import { DataLinksActionsTooltip } from '../DataLinksActionsTooltip';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { type DataLinksActionsTooltipState } from '../utils';

import { EmptyTablePlaceholder } from './components/EmptyTablePlaceholder';
import { getGridStyles, IS_SAFARI_26 } from './styles';
import {
  type CellRootRenderer,
  type InspectCellProps,
  type TableNGProps,
  type TableRow as BaseTableRow,
  type TableSummaryRow,
} from './types';
import { rowKeyGetter } from './utils';

type OnCellClick<TableRow extends BaseTableRow = BaseTableRow> = NonNullable<
  DataGridProps<TableRow, TableSummaryRow>['onCellClick']
>;
type OnCellKeyDown<TableRow extends BaseTableRow = BaseTableRow> = NonNullable<
  DataGridProps<TableRow, TableSummaryRow>['onCellKeyDown']
>;
type RenderRowFn<TableRow extends BaseTableRow = BaseTableRow> = NonNullable<
  NonNullable<DataGridProps<TableRow, TableSummaryRow>['renderers']>['renderRow']
>;

// Props that TableDataGrid manages internally — consumers must not override these.
type OmittedDataGridProps =
  | 'className'
  | 'role'
  | 'rowKeyGetter'
  | 'selectedRows'
  | 'onSelectedRowsChange'
  | 'isRowSelectionDisabled'
  | 'onSortColumnsChange'
  | 'defaultColumnOptions'
  | 'bottomSummaryRows'
  | 'summaryRowHeight'
  | 'headerRowHeight'
  | 'headerRowClass'
  | 'renderers'
  | 'rowHeight'
  | 'sortColumns'
  | 'onCellClick'
  | 'onCellKeyDown';

export interface TableDataGridProps<TableRow extends BaseTableRow = BaseTableRow>
  extends Omit<DataGridProps<TableRow, TableSummaryRow>, OmittedDataGridProps> {
  role: 'grid' | 'treegrid';
  gridRef: RefObject<DataGridHandle>;
  noValue?: string;
  renderers: {
    renderRow: RenderRowFn<TableRow>;
    renderCell: CellRootRenderer;
  };
  onCellClick: OnCellClick<TableRow>;
  onCellKeyDown: OnCellKeyDown<TableRow>;
  sortColumns: SortColumn[];
  setSortColumns: Dispatch<SetStateAction<SortColumn[]>>;
  onSortByChange?: TableNGProps['onSortByChange'];
  rowHeight: NonNullable<DataGridProps<TableRow, TableSummaryRow>['rowHeight']>;
  hasFooter: boolean;
  footerHeight: number;
  noHeader: boolean;
  headerHeight: number;
  transparent?: boolean;
  initialRowIndex?: number;
  sortedRows: TableRow[];
  enablePagination: boolean;
  numRows: number;
  page: number;
  setPage: (page: number) => void;
  numPages: number;
  pageRangeStart: number;
  pageRangeEnd: number;
  smallPagination: boolean;
  tooltipState?: DataLinksActionsTooltipState;
  onTooltipClose: () => void;
  inspectCell?: InspectCellProps | null;
  onInspectCellDismiss: () => void;
}

export function TableDataGrid<TableRow extends BaseTableRow = BaseTableRow>({
  role,
  gridRef,
  columns,
  rows,
  noValue,
  renderers,
  onColumnResize,
  onCellClick,
  onCellKeyDown,
  sortColumns,
  setSortColumns,
  onSortByChange,
  rowHeight,
  enableVirtualization,
  hasFooter,
  footerHeight,
  noHeader,
  headerHeight,
  transparent,
  initialRowIndex,
  sortedRows,
  enablePagination,
  numRows,
  page,
  setPage,
  numPages,
  pageRangeStart,
  pageRangeEnd,
  smallPagination,
  tooltipState,
  onTooltipClose,
  inspectCell,
  onInspectCellDismiss,
  ...dataGridOverrides
}: TableDataGridProps<TableRow>) {
  const [selectedRows, setSelectedRows] = useState((): ReadonlySet<string> => new Set());

  const [scrollToIndex, setScrollToIndex] = useState(initialRowIndex);
  useEffect(() => {
    if (scrollToIndex !== undefined && sortedRows && gridRef.current?.scrollToCell) {
      const rowIdx = sortedRows.findIndex((row) => row.__index === scrollToIndex);
      gridRef.current.scrollToCell({ rowIdx });
      setScrollToIndex(undefined);
      setSelectedRows(new Set<string>([rowKeyGetter(sortedRows[rowIdx])]));
    }
  }, [scrollToIndex, sortedRows, gridRef]);

  const showPagination = enablePagination && numRows > 0;
  const styles = useStyles2(getGridStyles, showPagination, transparent);

  const commonDataGridProps = useMemo(
    () =>
      ({
        enableVirtualization: !IS_SAFARI_26 && enableVirtualization !== false && typeof rowHeight !== 'string',
        defaultColumnOptions: {
          minWidth: 50,
          resizable: true,
          sortable: true,
        },
        onSortColumnsChange: (newSortColumns: SortColumn[]) => {
          setSortColumns(newSortColumns);
          onSortByChange?.(
            newSortColumns.map(({ columnKey, direction }) => ({
              displayName: columnKey,
              desc: direction === 'DESC',
            }))
          );
        },
        sortColumns,
        rowHeight,
        bottomSummaryRows: hasFooter ? [{}] : undefined,
        summaryRowHeight: footerHeight,
        headerRowHeight: noHeader ? 0 : headerHeight,
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [
      enableVirtualization,
      rowHeight,
      sortColumns,
      setSortColumns,
      onSortByChange,
      hasFooter,
      footerHeight,
      noHeader,
      headerHeight,
    ]
  );

  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow, string>
        {...dataGridOverrides}
        {...commonDataGridProps}
        role={role}
        ref={gridRef}
        className={styles.grid}
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        isRowSelectionDisabled={() => initialRowIndex !== undefined}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        headerRowClass={clsx(styles.headerRow, noHeader ? styles.displayNone : '')}
        headerRowHeight={headerHeight}
        onColumnResize={onColumnResize}
        onCellClick={onCellClick}
        onCellKeyDown={onCellKeyDown}
        renderers={{
          renderRow: renderers.renderRow,
          renderCell: renderers.renderCell,
          noRowsFallback: <EmptyTablePlaceholder noValue={noValue} />,
        }}
      />

      {showPagination && (
        <div className={styles.paginationContainer}>
          <Pagination
            className="table-ng-pagination"
            currentPage={page + 1}
            numberOfPages={numPages}
            showSmallVersion={smallPagination}
            onNavigate={(toPage) => {
              setPage(toPage - 1);
            }}
          />
          {!smallPagination && (
            <div className={styles.paginationSummary}>
              <Trans i18nKey="grafana-ui.table.pagination-summary">
                {{ itemsRangeStart }} - {{ displayedEnd }} of {{ numRows }} rows
              </Trans>
            </div>
          )}
        </div>
      )}

      {tooltipState && (
        <DataLinksActionsTooltip
          links={tooltipState.links ?? []}
          actions={tooltipState.actions}
          coords={tooltipState.coords}
          onTooltipClose={onTooltipClose}
        />
      )}

      {inspectCell && (
        <TableCellInspector
          mode={inspectCell.mode ?? TableCellInspectorMode.text}
          value={inspectCell.value}
          onDismiss={onInspectCellDismiss}
        />
      )}
    </>
  );
}
