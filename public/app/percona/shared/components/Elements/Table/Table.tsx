/* eslint-disable @typescript-eslint/no-explicit-any */
import { cx } from '@emotion/css';
import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  ColumnInstance,
  PluginHook,
  Row,
  useExpanded,
  usePagination,
  useRowSelect,
  UseRowSelectInstanceProps,
  UseRowSelectRowProps,
  useTable,
} from 'react-table';

import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';

import { Filter } from './Filter/Filter';
import { Pagination } from './Pagination';
import { PAGE_SIZES } from './Pagination/Pagination.constants';
import { TableCheckbox } from './Selection';
import { getStyles } from './Table.styles';
import { PaginatedTableOptions, PaginatedTableState, TableProps } from './Table.types';
import { TableContent } from './TableContent';

const defaultPropGetter = () => ({});

export const Table: FC<TableProps> = ({
  pendingRequest = false,
  data: rawData,
  columns,
  showPagination,
  rowSelection,
  totalPages,
  onPaginationChanged = () => null,
  emptyMessage = '',
  emptyMessageClassName,
  overlayClassName,
  totalItems,
  pageSize: propPageSize,
  pageIndex: propPageIndex = 0,
  pagesPerView,
  children,
  autoResetExpanded = true,
  autoResetPage = true,
  autoResetSelectedRows = true,
  renderExpandedRow = () => <></>,
  onRowSelection,
  allRowsSelectionMode = 'all',
  getHeaderProps = defaultPropGetter,
  getRowProps = defaultPropGetter,
  getColumnProps = defaultPropGetter,
  getCellProps = defaultPropGetter,
  showFilter = false,
  hasBackendFiltering = false,
  getRowId,
  tableKey,
}) => {
  const [filterData, setFilteredData] = useState<Object[]>([]);
  const data = useMemo(() => (showFilter ? filterData : rawData), [showFilter, filterData, rawData]);
  const style = useStyles(getStyles);
  const manualPagination = !!(totalPages && totalPages >= 0);
  const initialState: Partial<PaginatedTableState> = {
    pageIndex: propPageIndex,
    hiddenColumns: columns.filter((c) => c.hidden && c.id).map((c) => c.id!),
  };
  const tableOptions: PaginatedTableOptions = {
    columns,
    data,
    initialState,
    manualPagination,
    autoResetExpanded,
    autoResetPage,
    autoResetSelectedRows,
    getRowId,
  };
  const plugins: Array<PluginHook<any>> = [useExpanded];

  if (showPagination) {
    plugins.push(usePagination);

    if (manualPagination) {
      tableOptions.pageCount = totalPages;
    }

    if (propPageSize) {
      initialState.pageSize = propPageSize;
    }
  }

  if (rowSelection) {
    plugins.push(useRowSelect);
    plugins.push((hooks: any) => {
      hooks.visibleColumns.push((cols: Array<ColumnInstance<any>>) => [
        {
          id: 'selection',
          width: '50px',
          Header: ({
            getToggleAllRowsSelectedProps,
            getToggleAllPageRowsSelectedProps,
          }: UseRowSelectInstanceProps<any>) => (
            <div data-testid="select-all">
              <TableCheckbox
                id="all"
                {...(allRowsSelectionMode === 'all' || !showPagination
                  ? getToggleAllRowsSelectedProps()
                  : getToggleAllPageRowsSelectedProps())}
              />
            </div>
          ),
          Cell: ({ row }: { row: UseRowSelectRowProps<any> & Row<any> }) => (
            <div data-testid="select-row">
              <TableCheckbox id={row.id} {...row.getToggleRowSelectedProps()} />
            </div>
          ),
        },
        ...cols,
      ]);
    });
  }

  const tableInstance = useTable(tableOptions, ...plugins);
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    rows,
    prepareRow,
    visibleColumns,
    pageCount,
    setPageSize,
    gotoPage,
    selectedFlatRows,
    state: { pageSize, pageIndex },
  } = tableInstance;
  const hasData = data.length > 0;

  const onPageChanged = (newPageIndex: number) => {
    gotoPage(newPageIndex);
    onPaginationChanged(pageSize, newPageIndex);
  };

  const onPageSizeChanged = (newPageSize: number) => {
    gotoPage(0);
    setPageSize(newPageSize);
    onPaginationChanged(newPageSize, 0);
  };

  useEffect(() => {
    if (onRowSelection) {
      onRowSelection(selectedFlatRows);
    }
  }, [onRowSelection, selectedFlatRows]);

  return (<>
    <Overlay dataTestId="table-loading" isPending={pendingRequest} overlayClassName={overlayClassName}>
      {showFilter && (
        <Filter
          columns={columns}
          rawData={rawData}
          setFilteredData={setFilteredData}
          hasBackendFiltering={hasBackendFiltering}
          tableKey={tableKey}
        />
      )}
      <div className={style.tableWrap} data-testid="table-outer-wrapper">
        <div className={style.table} data-testid="table-inner-wrapper">
          <TableContent
            loading={pendingRequest}
            hasData={hasData}
            emptyMessage={emptyMessage}
            emptyMessageClassName={emptyMessageClassName}
          >
            <table {...getTableProps()} data-testid="table">
              <thead data-testid="table-thead">
                {headerGroups.map((headerGroup) => (
                  /* eslint-disable-next-line react/jsx-key */
                  (<tr data-testid="table-tbody-tr" {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column) => (
                      /* eslint-disable-next-line react/jsx-key */
                      (<th
                        className={style.tableHeader(column.width)}
                        {...column.getHeaderProps([
                          {
                            className: column.className,
                            style: column.style,
                          },
                          getColumnProps(column),
                          getHeaderProps(column),
                        ])}
                      >
                        {column.render('Header')}
                        {!!column.tooltipInfo && (
                          <Tooltip interactive content={column.tooltipInfo} placement="bottom-end">
                            <Icon tabIndex={0} name="info-circle" size="sm" className={style.infoIcon} />
                          </Tooltip>
                        )}
                      </th>)
                    ))}
                  </tr>)
                ))}
              </thead>
              <tbody {...getTableBodyProps()} data-testid="table-tbody">
                {children
                  ? children(showPagination ? page : rows, tableInstance)
                  : (showPagination ? page : rows).map((row) => {
                      prepareRow(row);
                      return (
                        <React.Fragment key={row.id}>
                          <tr data-testid="table-tbody-tr" {...row.getRowProps(getRowProps(row))}>
                            {row.cells.map((cell) => {
                              return (
                                <td
                                  title={
                                    typeof cell.value === 'string' || typeof cell.value === 'number'
                                      ? cell.value.toString()
                                      : undefined
                                  }
                                  {...cell.getCellProps([
                                    {
                                      className: cx(
                                        cell.column.className,
                                        style.tableCell(!!cell.column.noHiddenOverflow),
                                        cell.column?.Header === 'Summary' ? style.summaryWrap : undefined
                                      ),
                                      style: cell.column.style,
                                    },
                                    getCellProps(cell),
                                  ])}
                                  key={cell.column.id}
                                >
                                  {cell.render('Cell')}
                                </td>
                              );
                            })}
                          </tr>
                          {row.isExpanded ? (
                            <tr>
                              <td colSpan={visibleColumns.length}>{renderExpandedRow(row)}</td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
              </tbody>
            </table>
          </TableContent>
        </div>
      </div>
    </Overlay>
    {showPagination && hasData && (
      <Pagination
        pagesPerView={pagesPerView}
        pageCount={pageCount}
        initialPageIndex={pageIndex}
        totalItems={totalItems}
        pageSizeOptions={PAGE_SIZES}
        pageSize={pageSize}
        nrRowsOnCurrentPage={page.length}
        onPageChange={(pageIndex) => onPageChanged(pageIndex)}
        onPageSizeChange={(pageSize) => onPageSizeChanged(pageSize)}
      />
    )}
  </>);
};
