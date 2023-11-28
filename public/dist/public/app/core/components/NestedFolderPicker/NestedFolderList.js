import { css, cx } from '@emotion/css';
import React, { useCallback, useId, useMemo, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { IconButton, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Indent } from 'app/core/components/Indent/Indent';
import { Trans } from 'app/core/internationalization';
import { childrenByParentUIDSelector, rootItemsSelector } from 'app/features/browse-dashboards/state';
import { useSelector } from 'app/types';
const ROW_HEIGHT = 40;
const CHEVRON_SIZE = 'md';
export const getDOMId = (idPrefix, id) => `${idPrefix}-${id || 'root'}`;
export function NestedFolderList({ items, focusedItemIndex, foldersAreOpenable, idPrefix, selectedFolder, onFolderExpand, onFolderSelect, isItemLoaded, requestLoadMore, }) {
    const infiniteLoaderRef = useRef(null);
    const styles = useStyles2(getStyles);
    const virtualData = useMemo(() => ({
        items,
        focusedItemIndex,
        foldersAreOpenable,
        selectedFolder,
        onFolderExpand,
        onFolderSelect,
        idPrefix,
    }), [items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderExpand, onFolderSelect, idPrefix]);
    const handleIsItemLoaded = useCallback((itemIndex) => {
        return isItemLoaded(itemIndex);
    }, [isItemLoaded]);
    const handleLoadMore = useCallback((startIndex, endIndex) => {
        const { parentUID } = items[startIndex];
        requestLoadMore(parentUID);
    }, [requestLoadMore, items]);
    return (React.createElement("div", { className: styles.table, role: "tree" }, items.length > 0 ? (React.createElement(InfiniteLoader, { ref: infiniteLoaderRef, itemCount: items.length, isItemLoaded: handleIsItemLoaded, loadMoreItems: handleLoadMore }, ({ onItemsRendered, ref }) => (React.createElement(List, { ref: ref, height: ROW_HEIGHT * Math.min(6.5, items.length), width: "100%", itemData: virtualData, itemSize: ROW_HEIGHT, itemCount: items.length, onItemsRendered: onItemsRendered }, Row)))) : (React.createElement("div", { className: styles.emptyMessage },
        React.createElement(Trans, { i18nKey: "browse-dashboards.folder-picker.empty-message" }, "No folders found")))));
}
const SKELETON_WIDTHS = [100, 200, 130, 160, 150];
function Row({ index, style: virtualStyles, data }) {
    var _a, _b, _c, _d;
    const { items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderExpand, onFolderSelect, idPrefix } = data;
    const { item, isOpen, level, parentUID } = items[index];
    const rowRef = useRef(null);
    const labelId = useId();
    const rootCollection = useSelector(rootItemsSelector);
    const childrenCollections = useSelector(childrenByParentUIDSelector);
    const children = (_b = (_a = (item.uid ? childrenCollections[item.uid] : rootCollection)) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
    let siblings = [];
    // only look for siblings if we're not at the root
    if (item.uid) {
        siblings = (_d = (_c = (parentUID ? childrenCollections[parentUID] : rootCollection)) === null || _c === void 0 ? void 0 : _c.items) !== null && _d !== void 0 ? _d : [];
    }
    const styles = useStyles2(getStyles);
    const handleExpand = useCallback((ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (item.uid) {
            onFolderExpand(item.uid, !isOpen);
        }
    }, [item.uid, isOpen, onFolderExpand]);
    const handleSelect = useCallback(() => {
        if (item.kind === 'folder') {
            onFolderSelect(item);
        }
    }, [item, onFolderSelect]);
    if (item.kind === 'ui' && item.uiKind === 'pagination-placeholder') {
        return (React.createElement("span", { style: virtualStyles, className: styles.row },
            React.createElement(Indent, { level: level, spacing: 2 }),
            React.createElement(Skeleton, { width: SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] })));
    }
    if (item.kind !== 'folder') {
        return process.env.NODE_ENV !== 'production' ? (React.createElement("span", { style: virtualStyles, className: styles.row },
            "Non-folder ",
            item.kind,
            " ",
            item.uid)) : null;
    }
    return (
    // don't need a key handler here, it's handled at the input level in NestedFolderPicker
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    React.createElement("div", { ref: rowRef, style: virtualStyles, className: cx(styles.row, {
            [styles.rowFocused]: index === focusedItemIndex,
            [styles.rowSelected]: item.uid === selectedFolder,
        }), tabIndex: -1, onClick: handleSelect, "aria-expanded": isOpen, "aria-selected": item.uid === selectedFolder, "aria-labelledby": labelId, "aria-level": level + 1, role: "treeitem", "aria-owns": children.length > 0 ? children.map((child) => getDOMId(idPrefix, child.uid)).join(' ') : undefined, "aria-setsize": children.length, "aria-posinset": siblings.findIndex((i) => i.uid === item.uid) + 1, id: getDOMId(idPrefix, item.uid) },
        React.createElement("div", { className: styles.rowBody },
            React.createElement(Indent, { level: level, spacing: 2 }),
            foldersAreOpenable ? (React.createElement(IconButton, { size: CHEVRON_SIZE, 
                // by using onMouseDown here instead of onClick we can stop focus moving
                // to the button when the user clicks it (via preventDefault + stopPropagation)
                onMouseDown: handleExpand, 
                // tabIndex not needed here because we handle keyboard navigation at the input level
                tabIndex: -1, "aria-label": isOpen ? `Collapse folder ${item.title}` : `Expand folder ${item.title}`, name: isOpen ? 'angle-down' : 'angle-right' })) : (React.createElement("span", { className: styles.folderButtonSpacer })),
            React.createElement("label", { className: styles.label, id: labelId },
                React.createElement(Text, { truncate: true }, item.title)))));
}
const getStyles = (theme) => {
    const rowBody = css({
        height: ROW_HEIGHT,
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        flexGrow: 1,
        gap: theme.spacing(0.5),
        overflow: 'hidden',
        padding: theme.spacing(0, 1),
    });
    return {
        table: css({
            background: theme.components.input.background,
        }),
        emptyMessage: css({
            padding: theme.spacing(1),
            textAlign: 'center',
            width: '100%',
        }),
        // Should be the same size as the <IconButton /> for proper alignment
        folderButtonSpacer: css({
            paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(0.5)})`,
        }),
        row: css({
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
            [':not(:first-child)']: {
                borderTop: `solid 1px ${theme.colors.border.weak}`,
            },
        }),
        rowFocused: css({
            backgroundColor: theme.colors.background.secondary,
        }),
        rowSelected: css({
            '&::before': {
                display: 'block',
                content: '""',
                position: 'absolute',
                left: 0,
                bottom: 0,
                top: 0,
                width: 4,
                borderRadius: theme.shape.radius.default,
                backgroundImage: theme.colors.gradients.brandVertical,
            },
        }),
        rowBody,
        label: css({
            lineHeight: ROW_HEIGHT + 'px',
            flexGrow: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': {
                textDecoration: 'underline',
                cursor: 'pointer',
            },
        }),
    };
};
//# sourceMappingURL=NestedFolderList.js.map