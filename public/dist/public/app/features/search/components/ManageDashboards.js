import { __makeTemplateObject, __read } from "tslib";
import React, { memo, useState } from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme, Spinner, FilterInput } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { useManageDashboards } from '../hooks/useManageDashboards';
import { SearchLayout } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';
import { DashboardActions } from './DashboardActions';
var isEditor = contextSrv.isEditor;
export var ManageDashboards = memo(function (_a) {
    var folder = _a.folder;
    var folderId = folder === null || folder === void 0 ? void 0 : folder.id;
    var folderUid = folder === null || folder === void 0 ? void 0 : folder.uid;
    var theme = useTheme();
    var styles = getStyles(theme);
    var _b = __read(useState(false), 2), isDeleteModalOpen = _b[0], setIsDeleteModalOpen = _b[1];
    var _c = __read(useState(false), 2), isMoveModalOpen = _c[0], setIsMoveModalOpen = _c[1];
    var defaultLayout = folderId ? SearchLayout.List : SearchLayout.Folders;
    var queryParamsDefaults = {
        skipRecent: true,
        skipStarred: true,
        folderIds: folderId ? [folderId] : [],
        layout: defaultLayout,
    };
    var _d = useSearchQuery(queryParamsDefaults), query = _d.query, hasFilters = _d.hasFilters, onQueryChange = _d.onQueryChange, onTagFilterChange = _d.onTagFilterChange, onStarredFilterChange = _d.onStarredFilterChange, onTagAdd = _d.onTagAdd, onSortChange = _d.onSortChange, onLayoutChange = _d.onLayoutChange;
    var _e = useManageDashboards(query, {}, folder), results = _e.results, loading = _e.loading, initialLoading = _e.initialLoading, canSave = _e.canSave, allChecked = _e.allChecked, hasEditPermissionInFolders = _e.hasEditPermissionInFolders, canMove = _e.canMove, canDelete = _e.canDelete, onToggleSection = _e.onToggleSection, onToggleChecked = _e.onToggleChecked, onToggleAllChecked = _e.onToggleAllChecked, onDeleteItems = _e.onDeleteItems, onMoveItems = _e.onMoveItems, noFolders = _e.noFolders;
    var onMoveTo = function () {
        setIsMoveModalOpen(true);
    };
    var onItemDelete = function () {
        setIsDeleteModalOpen(true);
    };
    if (initialLoading) {
        return React.createElement(Spinner, { className: styles.spinner });
    }
    if (noFolders && !hasFilters) {
        return (React.createElement(EmptyListCTA, { title: "This folder doesn't have any dashboards yet", buttonIcon: "plus", buttonTitle: "Create Dashboard", buttonLink: "dashboard/new?folderId=" + folderId, proTip: "Add/move dashboards to your folder at ->", proTipLink: "dashboards", proTipLinkTitle: "Manage dashboards", proTipTarget: "" }));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: "page-action-bar" },
            React.createElement("div", { className: "gf-form gf-form--grow m-r-2" },
                React.createElement(FilterInput, { value: query.query, onChange: onQueryChange, placeholder: 'Search dashboards by name' })),
            React.createElement(DashboardActions, { isEditor: isEditor, canEdit: hasEditPermissionInFolders || canSave, folderId: folderId })),
        React.createElement("div", { className: styles.results },
            React.createElement(SearchResultsFilter, { allChecked: allChecked, canDelete: hasEditPermissionInFolders && canDelete, canMove: hasEditPermissionInFolders && canMove, deleteItem: onItemDelete, moveTo: onMoveTo, onToggleAllChecked: onToggleAllChecked, onStarredFilterChange: onStarredFilterChange, onSortChange: onSortChange, onTagFilterChange: onTagFilterChange, query: query, hideLayout: !!folderUid, onLayoutChange: onLayoutChange, editable: hasEditPermissionInFolders }),
            React.createElement(SearchResults, { loading: loading, results: results, editable: hasEditPermissionInFolders, onTagSelected: onTagAdd, onToggleSection: onToggleSection, onToggleChecked: onToggleChecked, layout: query.layout })),
        React.createElement(ConfirmDeleteModal, { onDeleteItems: onDeleteItems, results: results, isOpen: isDeleteModalOpen, onDismiss: function () { return setIsDeleteModalOpen(false); } }),
        React.createElement(MoveToFolderModal, { onMoveItems: onMoveItems, results: results, isOpen: isMoveModalOpen, onDismiss: function () { return setIsMoveModalOpen(false); } })));
});
export default ManageDashboards;
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "], ["\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "]))),
        results: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 0;\n      height: 100%;\n      padding-top: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 0;\n      height: 100%;\n      padding-top: ", ";\n    "])), theme.spacing.lg),
        spinner: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      min-height: 200px;\n    "], ["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      min-height: 200px;\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ManageDashboards.js.map