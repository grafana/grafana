import { __assign } from "tslib";
import { useCallback, useMemo, useReducer } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { DELETE_ITEMS, MOVE_ITEMS, TOGGLE_ALL_CHECKED, TOGGLE_CHECKED } from '../reducers/actionTypes';
import { manageDashboardsReducer, manageDashboardsState } from '../reducers/manageDashboards';
import { useSearch } from './useSearch';
import { GENERAL_FOLDER_ID } from '../constants';
export var useManageDashboards = function (query, state, folder) {
    if (state === void 0) { state = {}; }
    var reducer = useReducer(manageDashboardsReducer, __assign(__assign({}, manageDashboardsState), state));
    var _a = useSearch(query, reducer, {}), _b = _a.state, results = _b.results, loading = _b.loading, initialLoading = _b.initialLoading, allChecked = _b.allChecked, onToggleSection = _a.onToggleSection, dispatch = _a.dispatch;
    var onToggleChecked = useCallback(function (item) {
        dispatch({ type: TOGGLE_CHECKED, payload: item });
    }, [dispatch]);
    var onToggleAllChecked = function () {
        dispatch({ type: TOGGLE_ALL_CHECKED });
    };
    var onDeleteItems = function (folders, dashboards) {
        dispatch({ type: DELETE_ITEMS, payload: { folders: folders, dashboards: dashboards } });
    };
    var onMoveItems = function (selectedDashboards, folder) {
        dispatch({ type: MOVE_ITEMS, payload: { dashboards: selectedDashboards, folder: folder } });
    };
    var canMove = useMemo(function () { return results.some(function (result) { return result.items && result.items.some(function (item) { return item.checked; }); }); }, [
        results,
    ]);
    var canDelete = useMemo(function () {
        var includesGeneralFolder = results.find(function (result) { return result.checked && result.id === GENERAL_FOLDER_ID; });
        return canMove && !includesGeneralFolder;
    }, [canMove, results]);
    var canSave = folder === null || folder === void 0 ? void 0 : folder.canSave;
    var hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;
    var noFolders = canSave && (folder === null || folder === void 0 ? void 0 : folder.id) && results.length === 0 && !loading && !initialLoading;
    return {
        results: results,
        loading: loading,
        initialLoading: initialLoading,
        canSave: canSave,
        allChecked: allChecked,
        hasEditPermissionInFolders: hasEditPermissionInFolders,
        canMove: canMove,
        canDelete: canDelete,
        onToggleSection: onToggleSection,
        onToggleChecked: onToggleChecked,
        onToggleAllChecked: onToggleAllChecked,
        onDeleteItems: onDeleteItems,
        onMoveItems: onMoveItems,
        noFolders: noFolders,
    };
};
//# sourceMappingURL=useManageDashboards.js.map