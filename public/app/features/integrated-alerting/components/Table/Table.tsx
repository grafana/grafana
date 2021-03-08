import React, { FC } from 'react';
import { useTable, usePagination, useExpanded } from 'react-table';
import { css } from 'emotion';
import { useStyles } from '@grafana/ui';
import { getStyles } from './Table.styles';
import { TableProps, PaginatedTableInstance, PaginatedTableOptions, PaginatedTableState } from './Table.types';
import { Pagination } from './Pagination';
import { PAGE_SIZES } from './Pagination/Pagination.constants';
import { TableContent } from './TableContent';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';

export const Table: FC<TableProps> = ({
  pendingRequest = false,
  data,
  columns,
  showPagination,
  totalPages,
  onPaginationChanged = () => null,
  emptyMessage = '',
  totalItems,
  pageSize: propPageSize,
  pageIndex: propPageIndex = 0,
  pagesPerView,
  children,
  renderExpandedRow = () => <></>,
}) => {
  const style = useStyles(getStyles);
  const manualPagination = !!(totalPages && totalPages >= 0);
  const initialState: Partial<PaginatedTableState> = {
    pageIndex: propPageIndex,
  };
  const tableOptions: PaginatedTableOptions = {
    columns,
    data,
    initialState,
    manualPagination,
  };
  const plugins: any[] = [useExpanded];

  if (showPagination) {
    plugins.push(usePagination);

    if (manualPagination) {
      tableOptions.pageCount = totalPages;
    }

    if (propPageSize) {
      initialState.pageSize = propPageSize;
    }
  }

  const tableInstance = useTable(tableOptions, ...plugins) as PaginatedTableInstance;
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

  return (
    <>
      <Overlay dataQa="table-loading" isPending={pendingRequest}>
        <div className={style.tableWrap} data-qa="table-outer-wrapper">
          <div className={style.table} data-qa="table-inner-wrapper">
            <TableContent loading={pendingRequest} hasData={hasData} emptyMessage={emptyMessage}>
              <table {...getTableProps()} data-qa="table">
                <thead data-qa="table-thead">
                  {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                      {headerGroup.headers.map(column => (
                        <th
                          className={css`
                            width: ${column.width};
                          `}
                          {...column.getHeaderProps()}
                        >
                          {column.render('Header')}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody {...getTableBodyProps()} data-qa="table-tbody">
                  {children
                    ? children(showPagination ? page : rows, tableInstance)
                    : (showPagination ? page : rows).map(row => {
                        prepareRow(row);
                        return (
                          <React.Fragment key={row.id}>
                            <tr {...row.getRowProps()}>
                              {row.cells.map(cell => {
                                return (
                                  <td {...cell.getCellProps()} key={cell.column.id}>
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
          onPageChange={pageIndex => onPageChanged(pageIndex)}
          onPageSizeChange={pageSize => onPageSizeChanged(pageSize)}
        />
      )}
    </>
  );
};
