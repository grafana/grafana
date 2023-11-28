import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { memo, useEffect, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { reportInteraction } from '@grafana/runtime';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useDispatch } from 'app/types';
import { buildNavModel, getDashboardsTabID } from '../folders/state/navModel';
import { useSearchStateManager } from '../search/state/SearchStateManager';
import { getSearchPlaceholder } from '../search/tempI18nPhrases';
import { skipToken, useGetFolderQuery, useSaveFolderMutation } from './api/browseDashboardsAPI';
import { BrowseActions } from './components/BrowseActions/BrowseActions';
import { BrowseFilters } from './components/BrowseFilters';
import { BrowseView } from './components/BrowseView';
import CreateNewButton from './components/CreateNewButton';
import { FolderActionsButton } from './components/FolderActionsButton';
import { SearchView } from './components/SearchView';
import { getFolderPermissions } from './permissions';
import { setAllSelection, useHasSelection } from './state';
// New Browse/Manage/Search Dashboards views for nested folders
const BrowseDashboardsPage = memo(({ match }) => {
    const { uid: folderUID } = match.params;
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const [searchState, stateManager] = useSearchStateManager();
    const isSearching = stateManager.hasSearchFilters();
    useEffect(() => {
        stateManager.initStateFromUrl(folderUID);
        // Clear selected state when folderUID changes
        dispatch(setAllSelection({
            isSelected: false,
            folderUID: undefined,
        }));
    }, [dispatch, folderUID, stateManager]);
    useEffect(() => {
        // Clear the search results when we leave SearchView to prevent old results flashing
        // when starting a new search
        if (!isSearching && searchState.result) {
            stateManager.setState({ result: undefined, includePanels: undefined });
        }
    }, [isSearching, searchState.result, stateManager]);
    const { data: folderDTO } = useGetFolderQuery(folderUID !== null && folderUID !== void 0 ? folderUID : skipToken);
    const [saveFolder] = useSaveFolderMutation();
    const navModel = useMemo(() => {
        var _a;
        if (!folderDTO) {
            return undefined;
        }
        const model = buildNavModel(folderDTO);
        // Set the "Dashboards" tab to active
        const dashboardsTabID = getDashboardsTabID(folderDTO.uid);
        const dashboardsTab = (_a = model.children) === null || _a === void 0 ? void 0 : _a.find((child) => child.id === dashboardsTabID);
        if (dashboardsTab) {
            dashboardsTab.active = true;
        }
        return model;
    }, [folderDTO]);
    const hasSelection = useHasSelection();
    const { canEditFolders, canEditDashboards, canCreateDashboards, canCreateFolders } = getFolderPermissions(folderDTO);
    const showEditTitle = canEditFolders && folderUID;
    const canSelect = canEditFolders || canEditDashboards;
    const onEditTitle = (newValue) => __awaiter(void 0, void 0, void 0, function* () {
        if (folderDTO) {
            const result = yield saveFolder(Object.assign(Object.assign({}, folderDTO), { title: newValue }));
            if ('error' in result) {
                reportInteraction('grafana_browse_dashboards_page_edit_folder_name', {
                    status: 'failed_with_error',
                    error: result.error,
                });
                throw result.error;
            }
            else {
                reportInteraction('grafana_browse_dashboards_page_edit_folder_name', { status: 'success' });
            }
        }
        else {
            reportInteraction('grafana_browse_dashboards_page_edit_folder_name', { status: 'failed_no_folderDTO' });
        }
    });
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: navModel, onEditTitle: showEditTitle ? onEditTitle : undefined, actions: React.createElement(React.Fragment, null,
            folderDTO && React.createElement(FolderActionsButton, { folder: folderDTO }),
            (canCreateDashboards || canCreateFolders) && (React.createElement(CreateNewButton, { parentFolder: folderDTO, canCreateDashboard: canCreateDashboards, canCreateFolder: canCreateFolders }))) },
        React.createElement(Page.Contents, { className: styles.pageContents },
            React.createElement(FilterInput, { placeholder: getSearchPlaceholder(searchState.includePanels), value: searchState.query, escapeRegex: false, onChange: (e) => stateManager.onQueryChange(e) }),
            hasSelection ? React.createElement(BrowseActions, null) : React.createElement(BrowseFilters, null),
            React.createElement("div", { className: styles.subView },
                React.createElement(AutoSizer, null, ({ width, height }) => isSearching ? (React.createElement(SearchView, { canSelect: canSelect, width: width, height: height })) : (React.createElement(BrowseView, { canSelect: canSelect, width: width, height: height, folderUID: folderUID })))))));
});
const getStyles = (theme) => ({
    pageContents: css({
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        height: '100%',
        rowGap: theme.spacing(1),
    }),
    // AutoSizer needs an element to measure the full height available
    subView: css({
        height: '100%',
    }),
});
BrowseDashboardsPage.displayName = 'BrowseDashboardsPage';
export default BrowseDashboardsPage;
//# sourceMappingURL=BrowseDashboardsPage.js.map