import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { useTable } from 'react-table';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { isTruthy } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import CheckboxCell from './CheckboxCell';
import CheckboxHeaderCell from './CheckboxHeaderCell';
import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { useCustomFlexLayout } from './customFlexTableLayout';
import { makeRowID } from './utils';
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 36;
export function DashboardsTree({ items, width, height, isSelected, onFolderClick, onAllSelectionChange, onItemSelectionChange, isItemLoaded, requestLoadMore, canSelect = false, }) {
    const treeID = useId();
    const infiniteLoaderRef = useRef(null);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        // If the tree changed identity, then some indexes that were previously loaded may now be unloaded,
        // especially after a refetch after a move/delete.
        // Clear that cache, and check if we need to trigger another load
        if (infiniteLoaderRef.current) {
            infiniteLoaderRef.current.resetloadMoreItemsCache(true);
        }
    }, [items]);
    const tableColumns = useMemo(() => {
        const checkboxColumn = {
            id: 'checkbox',
            width: 0,
            Header: CheckboxHeaderCell,
            Cell: CheckboxCell,
        };
        const nameColumn = {
            id: 'name',
            width: 3,
            Header: (React.createElement("span", { style: { paddingLeft: 24 } },
                React.createElement(Trans, { i18nKey: "browse-dashboards.dashboards-tree.name-column" }, "Name"))),
            Cell: (props) => React.createElement(NameCell, Object.assign({}, props, { onFolderClick: onFolderClick })),
        };
        const tagsColumns = {
            id: 'tags',
            width: 2,
            Header: t('browse-dashboards.dashboards-tree.tags-column', 'Tags'),
            Cell: TagsCell,
        };
        const columns = [canSelect && checkboxColumn, nameColumn, tagsColumns].filter(isTruthy);
        return columns;
    }, [onFolderClick, canSelect]);
    const table = useTable({ columns: tableColumns, data: items }, useCustomFlexLayout);
    const { getTableProps, getTableBodyProps, headerGroups } = table;
    const virtualData = useMemo(() => ({
        table,
        isSelected,
        onAllSelectionChange,
        onItemSelectionChange,
        treeID,
    }), 
    // we need this to rerender if items changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, isSelected, onAllSelectionChange, onItemSelectionChange, items, treeID]);
    const handleIsItemLoaded = useCallback((itemIndex) => {
        return isItemLoaded(itemIndex);
    }, [isItemLoaded]);
    const handleLoadMore = useCallback((startIndex, endIndex) => {
        const { parentUID } = items[startIndex];
        requestLoadMore(parentUID);
    }, [requestLoadMore, items]);
    return (React.createElement("div", Object.assign({}, getTableProps(), { role: "table" }),
        headerGroups.map((headerGroup) => {
            const _a = headerGroup.getHeaderGroupProps({
                style: { width },
            }), { key } = _a, headerGroupProps = __rest(_a, ["key"]);
            return (React.createElement("div", Object.assign({ key: key }, headerGroupProps, { className: cx(styles.row, styles.headerRow) }), headerGroup.headers.map((column) => {
                const _a = column.getHeaderProps(), { key } = _a, headerProps = __rest(_a, ["key"]);
                return (React.createElement("div", Object.assign({ key: key }, headerProps, { role: "columnheader", className: styles.cell }), column.render('Header', { isSelected, onAllSelectionChange })));
            })));
        }),
        React.createElement("div", Object.assign({}, getTableBodyProps(), { "data-testid": selectors.pages.BrowseDashboards.table.body }),
            React.createElement(InfiniteLoader, { ref: infiniteLoaderRef, itemCount: items.length, isItemLoaded: handleIsItemLoaded, loadMoreItems: handleLoadMore }, ({ onItemsRendered, ref }) => (React.createElement(List, { ref: ref, height: height - HEADER_HEIGHT, width: width, itemCount: items.length, itemData: virtualData, itemSize: ROW_HEIGHT, onItemsRendered: onItemsRendered }, VirtualListRow))))));
}
function VirtualListRow({ index, style, data }) {
    const styles = useStyles2(getStyles);
    const { table, isSelected, onItemSelectionChange, treeID } = data;
    const { rows, prepareRow } = table;
    const row = rows[index];
    prepareRow(row);
    return (React.createElement("div", Object.assign({}, row.getRowProps({ style }), { className: cx(styles.row, styles.bodyRow), "aria-labelledby": makeRowID(treeID, row.original.item), "data-testid": selectors.pages.BrowseDashboards.table.row('title' in row.original.item ? row.original.item.title : row.original.item.uid) }), row.cells.map((cell) => {
        const _a = cell.getCellProps(), { key } = _a, cellProps = __rest(_a, ["key"]);
        return (React.createElement("div", Object.assign({ key: key }, cellProps, { className: styles.cell }), cell.render('Cell', { isSelected, onItemSelectionChange, treeID })));
    })));
}
const getStyles = (theme) => {
    return {
        // Column flex properties (cell sizing) are set by customFlexTableLayout.ts
        row: css({
            gap: theme.spacing(1),
        }),
        headerRow: css({
            backgroundColor: theme.colors.background.secondary,
            height: HEADER_HEIGHT,
        }),
        bodyRow: css({
            height: ROW_HEIGHT,
            '&:hover': {
                backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
            },
        }),
        cell: css({
            padding: theme.spacing(1),
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
        }),
        link: css({
            '&:hover': {
                textDecoration: 'underline',
            },
        }),
    };
};
//# sourceMappingURL=DashboardsTree.js.map