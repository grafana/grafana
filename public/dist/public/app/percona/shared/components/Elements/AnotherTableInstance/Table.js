/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useEffect } from 'react';
import { useRowSelect, useTable } from 'react-table';
import { Checkbox, Spinner, useTheme } from '@grafana/ui';
import { getStyles } from './Table.styles';
const TableCheckbox = ({ className, checked, onChange, title }) => (React.createElement("div", { className: className },
    React.createElement(Checkbox, { name: "table-checkbox", checked: checked, title: title, onChange: onChange })));
/**
 * @deprecated Use table in app/percona/shared/components/Elements/Table, merge changes if something is missing
 */
export const Table = ({ className, columns, rowSelection = false, onRowSelection, data, noData, loading, rowKey, }) => {
    const theme = useTheme();
    const styles = getStyles(theme);
    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow, 
    // @ts-ignore
    selectedFlatRows, } = useTable({
        columns,
        data,
    }, useRowSelect, (hooks) => {
        if (rowSelection) {
            hooks.visibleColumns.push((columns) => [
                {
                    id: 'selection',
                    Header: ({ getToggleAllRowsSelectedProps }) => (React.createElement("div", { "data-testid": "select-all" },
                        React.createElement(TableCheckbox, Object.assign({ className: styles.checkbox }, getToggleAllRowsSelectedProps())))),
                    Cell: ({ row }) => (React.createElement("div", { "data-testid": "select-row" },
                        React.createElement(TableCheckbox, Object.assign({ className: styles.checkbox }, row.getToggleRowSelectedProps())))),
                },
                ...columns,
            ]);
        }
    });
    useEffect(() => {
        if (onRowSelection) {
            onRowSelection(selectedFlatRows);
        }
    }, [selectedFlatRows, onRowSelection]);
    return (React.createElement("div", { className: cx(styles.table, className) },
        React.createElement("div", { className: styles.tableWrap },
            loading ? (React.createElement("div", { "data-testid": "table-loading", className: styles.empty },
                React.createElement(Spinner, null))) : null,
            !rows.length && !loading ? (React.createElement("div", { "data-testid": "table-no-data", className: styles.empty }, noData || React.createElement("h1", null, "No data"))) : null,
            rows.length && !loading ? (React.createElement("table", Object.assign({}, getTableProps()),
                React.createElement("thead", null, headerGroups.map((headerGroup, i) => (React.createElement("tr", Object.assign({ "data-testid": "table-header" }, headerGroup.getHeaderGroupProps(), { key: i }), headerGroup.headers.map((column, index) => (React.createElement("th", Object.assign({}, column.getHeaderProps(), { className: index === 0 && rowSelection ? styles.checkboxColumn : '', key: index }), column.render('Header')))))))),
                React.createElement("tbody", Object.assign({}, getTableBodyProps()), rows.map((row, i) => {
                    prepareRow(row);
                    return (React.createElement("tr", Object.assign({ "data-testid": "table-row" }, row.getRowProps(), { key: i }), row.cells.map((cell, index) => (React.createElement("td", Object.assign({}, cell.getCellProps(), { className: index === 0 && rowSelection ? styles.checkboxColumn : '', key: index }), cell.render('Cell'))))));
                })))) : null)));
};
//# sourceMappingURL=Table.js.map