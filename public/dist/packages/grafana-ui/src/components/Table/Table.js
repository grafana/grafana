import { __assign, __values } from "tslib";
import React, { memo, useCallback, useMemo } from 'react';
import { getFieldDisplayName } from '@grafana/data';
import { useAbsoluteLayout, useFilters, useResizeColumns, useSortBy, useTable, } from 'react-table';
import { FixedSizeList } from 'react-window';
import { getColumns, sortCaseInsensitive, sortNumber } from './utils';
import { getTableStyles } from './styles';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { TableCell } from './TableCell';
import { useStyles2 } from '../../themes';
import { FooterRow } from './FooterRow';
import { HeaderRow } from './HeaderRow';
var COLUMN_MIN_WIDTH = 150;
function useTableStateReducer(_a) {
    var onColumnResize = _a.onColumnResize, onSortByChange = _a.onSortByChange, data = _a.data;
    return useCallback(function (newState, action) {
        var e_1, _a;
        switch (action.type) {
            case 'columnDoneResizing':
                if (onColumnResize) {
                    var info = newState.columnResizing.headerIdWidths[0];
                    var columnIdString = info[0];
                    var fieldIndex = parseInt(columnIdString, 10);
                    var width = Math.round(newState.columnResizing.columnWidths[columnIdString]);
                    var field = data.fields[fieldIndex];
                    if (!field) {
                        return newState;
                    }
                    var fieldDisplayName = getFieldDisplayName(field, data);
                    onColumnResize(fieldDisplayName, width);
                }
            case 'toggleSortBy':
                if (onSortByChange) {
                    var sortByFields = [];
                    try {
                        for (var _b = __values(newState.sortBy), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var sortItem = _c.value;
                            var field = data.fields[parseInt(sortItem.id, 10)];
                            if (!field) {
                                continue;
                            }
                            sortByFields.push({
                                displayName: getFieldDisplayName(field, data),
                                desc: sortItem.desc,
                            });
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    onSortByChange(sortByFields);
                }
                break;
        }
        return newState;
    }, [data, onColumnResize, onSortByChange]);
}
function getInitialState(initialSortBy, columns) {
    var e_2, _a, e_3, _b;
    var state = {};
    if (initialSortBy) {
        state.sortBy = [];
        try {
            for (var initialSortBy_1 = __values(initialSortBy), initialSortBy_1_1 = initialSortBy_1.next(); !initialSortBy_1_1.done; initialSortBy_1_1 = initialSortBy_1.next()) {
                var sortBy = initialSortBy_1_1.value;
                try {
                    for (var columns_1 = (e_3 = void 0, __values(columns)), columns_1_1 = columns_1.next(); !columns_1_1.done; columns_1_1 = columns_1.next()) {
                        var col = columns_1_1.value;
                        if (col.Header === sortBy.displayName) {
                            state.sortBy.push({ id: col.id, desc: sortBy.desc });
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (columns_1_1 && !columns_1_1.done && (_b = columns_1.return)) _b.call(columns_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (initialSortBy_1_1 && !initialSortBy_1_1.done && (_a = initialSortBy_1.return)) _a.call(initialSortBy_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    return state;
}
export var Table = memo(function (props) {
    var ariaLabel = props.ariaLabel, data = props.data, height = props.height, onCellFilterAdded = props.onCellFilterAdded, width = props.width, _a = props.columnMinWidth, columnMinWidth = _a === void 0 ? COLUMN_MIN_WIDTH : _a, noHeader = props.noHeader, _b = props.resizable, resizable = _b === void 0 ? true : _b, initialSortBy = props.initialSortBy, footerValues = props.footerValues, showTypeIcons = props.showTypeIcons;
    var tableStyles = useStyles2(getTableStyles);
    // React table data array. This data acts just like a dummy array to let react-table know how many rows exist
    // The cells use the field to look up values
    var memoizedData = useMemo(function () {
        if (!data.fields.length) {
            return [];
        }
        // as we only use this to fake the length of our data set for react-table we need to make sure we always return an array
        // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
        // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
        return Array(data.length).fill(0);
    }, [data]);
    // React-table column definitions
    var memoizedColumns = useMemo(function () { return getColumns(data, width, columnMinWidth, footerValues); }, [
        data,
        width,
        columnMinWidth,
        footerValues,
    ]);
    // Internal react table state reducer
    var stateReducer = useTableStateReducer(props);
    var options = useMemo(function () { return ({
        columns: memoizedColumns,
        data: memoizedData,
        disableResizing: !resizable,
        stateReducer: stateReducer,
        initialState: getInitialState(initialSortBy, memoizedColumns),
        sortTypes: {
            number: sortNumber,
            'alphanumeric-insensitive': sortCaseInsensitive, // should be replace with the builtin string when react-table is upgraded, see https://github.com/tannerlinsley/react-table/pull/3235
        },
    }); }, [initialSortBy, memoizedColumns, memoizedData, resizable, stateReducer]);
    var _c = useTable(options, useFilters, useSortBy, useAbsoluteLayout, useResizeColumns), getTableProps = _c.getTableProps, headerGroups = _c.headerGroups, rows = _c.rows, prepareRow = _c.prepareRow, totalColumnsWidth = _c.totalColumnsWidth, footerGroups = _c.footerGroups;
    var fields = data.fields;
    var RenderRow = React.useCallback(function (_a) {
        var rowIndex = _a.index, style = _a.style;
        var row = rows[rowIndex];
        prepareRow(row);
        return (React.createElement("div", __assign({}, row.getRowProps({ style: style }), { className: tableStyles.row }), row.cells.map(function (cell, index) { return (React.createElement(TableCell, { key: index, field: fields[index], tableStyles: tableStyles, cell: cell, onCellFilterAdded: onCellFilterAdded, columnIndex: index, columnCount: row.cells.length })); })));
    }, [fields, onCellFilterAdded, prepareRow, rows, tableStyles]);
    var headerHeight = noHeader ? 0 : tableStyles.cellHeight;
    return (React.createElement("div", __assign({}, getTableProps(), { className: tableStyles.table, "aria-label": ariaLabel, role: "table" }),
        React.createElement(CustomScrollbar, { hideVerticalTrack: true },
            React.createElement("div", { style: { width: totalColumnsWidth ? totalColumnsWidth + "px" : '100%' } },
                !noHeader && React.createElement(HeaderRow, { data: data, headerGroups: headerGroups, showTypeIcons: showTypeIcons }),
                rows.length > 0 ? (React.createElement(FixedSizeList, { height: height - headerHeight, itemCount: rows.length, itemSize: tableStyles.rowHeight, width: '100%', style: { overflow: 'hidden auto' } }, RenderRow)) : (React.createElement("div", { style: { height: height - headerHeight }, className: tableStyles.noData }, "No data")),
                React.createElement(FooterRow, { footerValues: footerValues, footerGroups: footerGroups, totalColumnsWidth: totalColumnsWidth })))));
});
Table.displayName = 'Table';
//# sourceMappingURL=Table.js.map