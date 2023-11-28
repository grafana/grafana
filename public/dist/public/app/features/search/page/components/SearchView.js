import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStyles2, Spinner, Button } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Trans } from 'app/core/internationalization';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { getGrafanaSearcher } from '../../service';
import { getSearchStateManager } from '../../state/SearchStateManager';
import { SearchLayout } from '../../types';
import { newSearchSelection, updateSearchSelection } from '../selection';
import { ActionRow, getValidQueryLayout } from './ActionRow';
import { FolderSection } from './FolderSection';
import { ManageActions } from './ManageActions';
import { RootFolderView } from './RootFolderView';
import { SearchResultsCards } from './SearchResultsCards';
import { SearchResultsTable } from './SearchResultsTable';
export const SearchView = ({ showManage, folderDTO, hidePseudoFolders, keyboardEvents }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const stateManager = getSearchStateManager(); // State is initialized from URL by parent component
    const state = stateManager.useState();
    const [searchSelection, setSearchSelection] = useState(newSearchSelection());
    const layout = getValidQueryLayout(state);
    const isFolders = layout === SearchLayout.Folders;
    const [listKey, setListKey] = useState(Date.now());
    // Search usage reporting
    useDebounce(stateManager.onReportSearchUsage, 1000, []);
    const clearSelection = useCallback(() => {
        searchSelection.items.clear();
        setSearchSelection(Object.assign({}, searchSelection));
    }, [searchSelection]);
    const toggleSelection = useCallback((kind, uid) => {
        const current = searchSelection.isSelected(kind, uid);
        setSearchSelection(updateSearchSelection(searchSelection, !current, kind, [uid]));
    }, [searchSelection]);
    // function to update items when dashboards or folders are moved or deleted
    const onChangeItemsList = () => __awaiter(void 0, void 0, void 0, function* () {
        // clean up search selection
        clearSelection();
        setListKey(Date.now());
        // trigger again the search to the backend
        stateManager.onQueryChange(state.query);
    });
    const renderResults = () => {
        const value = state.result;
        if ((!value || !value.totalRows) && !isFolders) {
            if (state.loading && !value) {
                return React.createElement(Spinner, null);
            }
            return (React.createElement("div", { className: styles.noResults },
                React.createElement("div", null,
                    React.createElement(Trans, { i18nKey: "search-view.no-results.text" }, "No results found for your query.")),
                React.createElement("br", null),
                React.createElement(Button, { variant: "secondary", onClick: stateManager.onClearSearchAndFilters },
                    React.createElement(Trans, { i18nKey: "search-view.no-results.clear" }, "Clear search and filters"))));
        }
        const selection = showManage ? searchSelection.isSelected : undefined;
        if (layout === SearchLayout.Folders) {
            if (folderDTO) {
                return (React.createElement(FolderSection, { section: sectionForFolderView(folderDTO), selection: selection, selectionToggle: toggleSelection, onTagSelected: stateManager.onAddTag, renderStandaloneBody: true, tags: state.tag, key: listKey, onClickItem: stateManager.onSearchItemClicked }));
            }
            return (React.createElement(RootFolderView, { key: listKey, selection: selection, selectionToggle: toggleSelection, tags: state.tag, onTagSelected: stateManager.onAddTag, hidePseudoFolders: hidePseudoFolders, onClickItem: stateManager.onSearchItemClicked }));
        }
        return (React.createElement("div", { style: { height: '100%', width: '100%' } },
            React.createElement(AutoSizer, null, ({ width, height }) => {
                const props = {
                    response: value,
                    selection,
                    selectionToggle: toggleSelection,
                    clearSelection,
                    width: width,
                    height: height,
                    onTagSelected: stateManager.onAddTag,
                    keyboardEvents,
                    onDatasourceChange: state.datasource ? stateManager.onDatasourceChange : undefined,
                    onClickItem: stateManager.onSearchItemClicked,
                };
                if (width < 800) {
                    return React.createElement(SearchResultsCards, Object.assign({}, props));
                }
                return React.createElement(SearchResultsTable, Object.assign({}, props));
            })));
    };
    if (folderDTO &&
        // With nested folders, SearchView doesn't know if it's fetched all children
        // of a folder so don't show empty state here.
        !newBrowseDashboardsEnabled() &&
        !state.loading &&
        !((_a = state.result) === null || _a === void 0 ? void 0 : _a.totalRows) &&
        !stateManager.hasSearchFilters()) {
        return (React.createElement(EmptyListCTA, { title: "This folder doesn't have any dashboards yet", buttonIcon: "plus", buttonTitle: "Create Dashboard", buttonLink: `dashboard/new?folderUid=${folderDTO.uid}`, proTip: "Add/move dashboards to your folder at ->", proTipLink: "dashboards", proTipLinkTitle: "Manage dashboards", proTipTarget: "" }));
    }
    return (React.createElement(React.Fragment, null,
        Boolean(searchSelection.items.size > 0) ? (React.createElement(ManageActions, { items: searchSelection.items, onChange: onChangeItemsList, clearSelection: clearSelection })) : (React.createElement(ActionRow, { onLayoutChange: stateManager.onLayoutChange, showStarredFilter: hidePseudoFolders, onStarredFilterChange: !hidePseudoFolders ? undefined : stateManager.onStarredFilterChange, onSortChange: stateManager.onSortChange, onTagFilterChange: stateManager.onTagFilterChange, getTagOptions: stateManager.getTagOptions, getSortOptions: getGrafanaSearcher().getSortOptions, sortPlaceholder: getGrafanaSearcher().sortPlaceholder, onDatasourceChange: stateManager.onDatasourceChange, onPanelTypeChange: stateManager.onPanelTypeChange, state: state, includePanels: state.includePanels, onSetIncludePanels: stateManager.onSetIncludePanels })),
        renderResults()));
};
const getStyles = (theme) => ({
    searchInput: css `
    margin-bottom: 6px;
    min-height: ${theme.spacing(4)};
  `,
    unsupported: css `
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 18px;
  `,
    noResults: css `
    padding: ${theme.v1.spacing.md};
    background: ${theme.v1.colors.bg2};
    font-style: italic;
    margin-top: ${theme.v1.spacing.md};
  `,
});
function sectionForFolderView(folderDTO) {
    return { uid: folderDTO.uid, kind: 'folder', title: folderDTO.title };
}
//# sourceMappingURL=SearchView.js.map