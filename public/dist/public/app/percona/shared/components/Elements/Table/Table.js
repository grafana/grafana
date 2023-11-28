/* eslint-disable @typescript-eslint/no-explicit-any */
import { cx } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useExpanded, usePagination, useRowSelect, useTable, } from 'react-table';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { Filter } from './Filter/Filter';
import { Pagination } from './Pagination';
import { PAGE_SIZES } from './Pagination/Pagination.constants';
import { TableCheckbox } from './Selection';
import { getStyles } from './Table.styles';
import { TableContent } from './TableContent';
const defaultPropGetter = () => ({});
export const Table = ({ pendingRequest = false, data: rawData, columns, showPagination, rowSelection, totalPages, onPaginationChanged = () => null, emptyMessage = '', emptyMessageClassName, overlayClassName, totalItems, pageSize: propPageSize, pageIndex: propPageIndex = 0, pagesPerView, children, autoResetExpanded = true, autoResetPage = true, autoResetSelectedRows = true, renderExpandedRow = () => React.createElement(React.Fragment, null), onRowSelection, allRowsSelectionMode = 'all', getHeaderProps = defaultPropGetter, getRowProps = defaultPropGetter, getColumnProps = defaultPropGetter, getCellProps = defaultPropGetter, showFilter = false, hasBackendFiltering = false, getRowId, tableKey, }) => {
    const [filterData, setFilteredData] = useState([]);
    const data = useMemo(() => (showFilter ? filterData : rawData), [showFilter, filterData, rawData]);
    const style = useStyles(getStyles);
    const manualPagination = !!(totalPages && totalPages >= 0);
    const initialState = {
        pageIndex: propPageIndex,
        hiddenColumns: columns.filter((c) => c.hidden && c.id).map((c) => c.id),
    };
    const tableOptions = {
        columns,
        data,
        initialState,
        manualPagination,
        autoResetExpanded,
        autoResetPage,
        autoResetSelectedRows,
        getRowId,
    };
    const plugins = [useExpanded];
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
        plugins.push((hooks) => {
            hooks.visibleColumns.push((cols) => [
                {
                    id: 'selection',
                    width: '50px',
                    Header: ({ getToggleAllRowsSelectedProps, getToggleAllPageRowsSelectedProps, }) => (React.createElement("div", { "data-testid": "select-all" },
                        React.createElement(TableCheckbox, Object.assign({ id: "all" }, (allRowsSelectionMode === 'all' || !showPagination
                            ? getToggleAllRowsSelectedProps()
                            : getToggleAllPageRowsSelectedProps()))))),
                    Cell: ({ row }) => (React.createElement("div", { "data-testid": "select-row" },
                        React.createElement(TableCheckbox, Object.assign({ id: row.id }, row.getToggleRowSelectedProps())))),
                },
                ...cols,
            ]);
        });
    }
    const tableInstance = useTable(tableOptions, ...plugins);
    const { getTableProps, getTableBodyProps, headerGroups, page, rows, prepareRow, visibleColumns, pageCount, setPageSize, gotoPage, selectedFlatRows, state: { pageSize, pageIndex }, } = tableInstance;
    const hasData = data.length > 0;
    const onPageChanged = (newPageIndex) => {
        gotoPage(newPageIndex);
        onPaginationChanged(pageSize, newPageIndex);
    };
    const onPageSizeChanged = (newPageSize) => {
        gotoPage(0);
        setPageSize(newPageSize);
        onPaginationChanged(newPageSize, 0);
    };
    useEffect(() => {
        if (onRowSelection) {
            onRowSelection(selectedFlatRows);
        }
    }, [onRowSelection, selectedFlatRows]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Overlay, { dataTestId: "table-loading", isPending: pendingRequest, overlayClassName: overlayClassName },
            showFilter && (React.createElement(Filter, { columns: columns, rawData: rawData, setFilteredData: setFilteredData, hasBackendFiltering: hasBackendFiltering, tableKey: tableKey })),
            React.createElement("div", { className: style.tableWrap, "data-testid": "table-outer-wrapper" },
                React.createElement("div", { className: style.table, "data-testid": "table-inner-wrapper" },
                    React.createElement(TableContent, { loading: pendingRequest, hasData: hasData, emptyMessage: emptyMessage, emptyMessageClassName: emptyMessageClassName },
                        React.createElement("table", Object.assign({}, getTableProps(), { "data-testid": "table" }),
                            React.createElement("thead", { "data-testid": "table-thead" }, headerGroups.map((headerGroup) => (
                            /* eslint-disable-next-line react/jsx-key */
                            (React.createElement("tr", Object.assign({ "data-testid": "table-tbody-tr" }, headerGroup.getHeaderGroupProps()), headerGroup.headers.map((column) => (
                            /* eslint-disable-next-line react/jsx-key */
                            (React.createElement("th", Object.assign({ className: style.tableHeader(column.width) }, column.getHeaderProps([
                                {
                                    className: column.className,
                                    style: column.style,
                                },
                                getColumnProps(column),
                                getHeaderProps(column),
                            ])),
                                column.render('Header'),
                                !!column.tooltipInfo && (React.createElement(Tooltip, { interactive: true, content: column.tooltipInfo, placement: "bottom-end" },
                                    React.createElement(Icon, { tabIndex: 0, name: "info-circle", size: "sm", className: style.infoIcon })))))))))))),
                            React.createElement("tbody", Object.assign({}, getTableBodyProps(), { "data-testid": "table-tbody" }), children
                                ? children(showPagination ? page : rows, tableInstance)
                                : (showPagination ? page : rows).map((row) => {
                                    prepareRow(row);
                                    return (React.createElement(React.Fragment, { key: row.id },
                                        React.createElement("tr", Object.assign({ "data-testid": "table-tbody-tr" }, row.getRowProps(getRowProps(row))), row.cells.map((cell) => {
                                            var _a;
                                            return (React.createElement("td", Object.assign({ title: typeof cell.value === 'string' || typeof cell.value === 'number'
                                                    ? cell.value.toString()
                                                    : undefined }, cell.getCellProps([
                                                {
                                                    className: cx(cell.column.className, style.tableCell(!!cell.column.noHiddenOverflow), ((_a = cell.column) === null || _a === void 0 ? void 0 : _a.Header) === 'Summary' ? style.summaryWrap : undefined),
                                                    style: cell.column.style,
                                                },
                                                getCellProps(cell),
                                            ]), { key: cell.column.id }), cell.render('Cell')));
                                        })),
                                        row.isExpanded ? (React.createElement("tr", null,
                                            React.createElement("td", { colSpan: visibleColumns.length }, renderExpandedRow(row)))) : null));
                                }))))))),
        showPagination && hasData && (React.createElement(Pagination, { pagesPerView: pagesPerView, pageCount: pageCount, initialPageIndex: pageIndex, totalItems: totalItems, pageSizeOptions: PAGE_SIZES, pageSize: pageSize, nrRowsOnCurrentPage: page.length, onPageChange: (pageIndex) => onPageChanged(pageIndex), onPageSizeChange: (pageSize) => onPageSizeChanged(pageSize) }))));
};
//# sourceMappingURL=Table.js.map