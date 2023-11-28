import React, { useCallback } from 'react';
import { DataFrameView, toDataFrame } from '@grafana/data';
import { Button, Card } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types';
import { setAllSelection, setItemSelectionState, useHasSelection } from '../state';
const NUM_PLACEHOLDER_ROWS = 50;
const initialLoadingView = {
    view: new DataFrameView(toDataFrame({
        fields: [
            { name: 'uid', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill(null) },
            { name: 'kind', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('dashboard') },
            { name: 'name', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('') },
            { name: 'location', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('') },
            { name: 'tags', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill([]) },
        ],
        meta: {
            custom: {
                locationInfo: [],
            },
        },
    })),
    loadMoreItems: () => Promise.resolve(),
    // this is key and controls whether to show the skeleton in generateColumns
    isItemLoaded: () => false,
    totalRows: NUM_PLACEHOLDER_ROWS,
};
export function SearchView({ width, height, canSelect }) {
    var _a;
    const dispatch = useDispatch();
    const selectedItems = useSelector((wholeState) => wholeState.browseDashboards.selectedItems);
    const hasSelection = useHasSelection();
    const { keyboardEvents } = useKeyNavigationListener();
    const [searchState, stateManager] = useSearchStateManager();
    const value = (_a = searchState.result) !== null && _a !== void 0 ? _a : initialLoadingView;
    const selectionChecker = useCallback((kind, uid) => {
        var _a;
        if (!kind) {
            return false;
        }
        // Currently, this indicates _some_ items are selected, not nessicarily all are
        // selected.
        if (kind === '*' && uid === '*') {
            return hasSelection;
        }
        else if (kind === '*') {
            // Unsure how this case can happen
            return false;
        }
        return (_a = selectedItems[assertDashboardViewItemKind(kind)][uid]) !== null && _a !== void 0 ? _a : false;
    }, [selectedItems, hasSelection]);
    const clearSelection = useCallback(() => {
        dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
    }, [dispatch]);
    const handleItemSelectionChange = useCallback((kind, uid) => {
        const newIsSelected = !selectionChecker(kind, uid);
        dispatch(setItemSelectionState({ item: { kind: assertDashboardViewItemKind(kind), uid }, isSelected: newIsSelected }));
    }, [selectionChecker, dispatch]);
    if (value.totalRows === 0) {
        return (React.createElement("div", { style: { width } },
            React.createElement(Card, null,
                React.createElement(Card.Heading, null,
                    React.createElement(Trans, { i18nKey: "browse-dashboards.no-results.text" }, "No results found for your query.")),
                React.createElement(Card.Actions, null,
                    React.createElement(Button, { variant: "secondary", onClick: stateManager.onClearSearchAndFilters },
                        React.createElement(Trans, { i18nKey: "browse-dashboards.no-results.clear" }, "Clear search and filters"))))));
    }
    const props = {
        response: value,
        selection: canSelect ? selectionChecker : undefined,
        selectionToggle: canSelect ? handleItemSelectionChange : undefined,
        clearSelection,
        width: width,
        height: height,
        onTagSelected: stateManager.onAddTag,
        keyboardEvents,
        onDatasourceChange: searchState.datasource ? stateManager.onDatasourceChange : undefined,
        onClickItem: stateManager.onSearchItemClicked,
    };
    return React.createElement(SearchResultsTable, Object.assign({}, props));
}
function assertDashboardViewItemKind(kind) {
    switch (kind) {
        case 'folder':
            return 'folder';
        case 'dashboard':
            return 'dashboard';
        case 'panel':
            return 'panel';
    }
    throw new Error('Unsupported kind' + kind);
}
//# sourceMappingURL=SearchView.js.map