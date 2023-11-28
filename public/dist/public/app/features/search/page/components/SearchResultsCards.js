/* eslint-disable react/jsx-no-undef */
import { css } from '@emotion/css';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useStyles2 } from '@grafana/ui';
import { SearchItem } from '../../components/SearchItem';
import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { queryResultToViewItem } from '../../service/utils';
export const SearchResultsCards = React.memo(({ response, width, height, selection, selectionToggle, onTagSelected, keyboardEvents, onClickItem, }) => {
    const styles = useStyles2(getStyles);
    const infiniteLoaderRef = useRef(null);
    const [listEl, setListEl] = useState(null);
    const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, 0, response);
    // Scroll to the top and clear loader cache when the query results change
    useEffect(() => {
        if (infiniteLoaderRef.current) {
            infiniteLoaderRef.current.resetloadMoreItemsCache();
        }
        if (listEl) {
            listEl.scrollTo(0);
        }
    }, [response, listEl]);
    const RenderRow = useCallback(({ index: rowIndex, style }) => {
        let className = '';
        if (rowIndex === highlightIndex.y) {
            className += ' ' + styles.selectedRow;
        }
        const item = response.view.get(rowIndex);
        const searchItem = queryResultToViewItem(item, response.view);
        const isSelected = selectionToggle && (selection === null || selection === void 0 ? void 0 : selection(searchItem.kind, searchItem.uid));
        return (React.createElement("div", { style: style, key: item.uid, className: className, role: "row" },
            React.createElement(SearchItem, { item: searchItem, onTagSelected: onTagSelected, onToggleChecked: (item) => {
                    if (selectionToggle) {
                        selectionToggle('dashboard', item.uid);
                    }
                }, editable: Boolean(selection != null), onClickItem: onClickItem, isSelected: isSelected })));
    }, [response.view, highlightIndex, styles, onTagSelected, selection, selectionToggle, onClickItem]);
    if (!response.totalRows) {
        return (React.createElement("div", { className: styles.noData, style: { width } }, "No data"));
    }
    return (React.createElement("div", { "aria-label": "Search results list", style: { width }, role: "list" },
        React.createElement(InfiniteLoader, { ref: infiniteLoaderRef, isItemLoaded: response.isItemLoaded, itemCount: response.totalRows, loadMoreItems: response.loadMoreItems }, ({ onItemsRendered, ref }) => (React.createElement(FixedSizeList, { ref: (innerRef) => {
                ref(innerRef);
                setListEl(innerRef);
            }, onItemsRendered: onItemsRendered, height: height, itemCount: response.totalRows, itemSize: 72, width: "100%", style: { overflow: 'hidden auto' } }, RenderRow)))));
});
SearchResultsCards.displayName = 'SearchResultsCards';
const getStyles = (theme) => {
    return {
        noData: css `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    `,
        selectedRow: css `
      border-left: 3px solid ${theme.colors.primary.border};
    `,
    };
};
//# sourceMappingURL=SearchResultsCards.js.map