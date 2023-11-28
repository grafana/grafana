import { __awaiter } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { addToRichHistory, deleteAllFromRichHistory, deleteQueryInRichHistory, getRichHistory, getRichHistorySettings, updateCommentInRichHistory, updateRichHistorySettings, updateStarredInRichHistory, } from 'app/core/utils/richHistory';
import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { richHistoryLimitExceededAction, richHistorySearchFiltersUpdatedAction, richHistorySettingsUpdatedAction, richHistoryStorageFullAction, richHistoryUpdatedAction, } from './main';
import { selectPanesEntries } from './selectors';
export const historyUpdatedAction = createAction('explore/historyUpdated');
/**
 * Updates current state in both Explore panes after changing or deleting a query history item
 */
const updateRichHistoryState = ({ updatedQuery, deletedId }) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        forEachExplorePane(getState().explore, (item, exploreId) => {
            const newRichHistory = item.richHistory
                // update
                .map((query) => (query.id === (updatedQuery === null || updatedQuery === void 0 ? void 0 : updatedQuery.id) ? updatedQuery : query))
                // or remove
                .filter((query) => query.id !== deletedId);
            const deletedItems = item.richHistory.length - newRichHistory.length;
            dispatch(richHistoryUpdatedAction({
                richHistoryResults: { richHistory: newRichHistory, total: item.richHistoryTotal - deletedItems },
                exploreId,
            }));
        });
    });
};
const forEachExplorePane = (state, callback) => {
    Object.entries(state.panes).forEach(([exploreId, item]) => {
        item && callback(item, exploreId);
    });
};
export const addHistoryItem = (datasourceUid, datasourceName, queries) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryStorageFull, limitExceeded } = yield addToRichHistory(datasourceUid, datasourceName, queries, false, '', !getState().explore.richHistoryStorageFull, !getState().explore.richHistoryLimitExceededWarningShown);
        if (richHistoryStorageFull) {
            dispatch(richHistoryStorageFullAction());
        }
        if (limitExceeded) {
            dispatch(richHistoryLimitExceededAction());
        }
    });
};
export const starHistoryItem = (id, starred) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedQuery = yield updateStarredInRichHistory(id, starred);
        dispatch(updateRichHistoryState({ updatedQuery }));
    });
};
export const commentHistoryItem = (id, comment) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedQuery = yield updateCommentInRichHistory(id, comment);
        dispatch(updateRichHistoryState({ updatedQuery }));
    });
};
export const deleteHistoryItem = (id) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedId = yield deleteQueryInRichHistory(id);
        dispatch(updateRichHistoryState({ deletedId }));
    });
};
export const deleteRichHistory = () => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        yield deleteAllFromRichHistory();
        selectPanesEntries(getState()).forEach(([exploreId]) => {
            dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 }, exploreId }));
            dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 }, exploreId }));
        });
    });
};
export const loadRichHistory = (exploreId) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const filters = getState().explore.panes[exploreId].richHistorySearchFilters;
        if (filters) {
            const richHistoryResults = yield getRichHistory(filters);
            dispatch(richHistoryUpdatedAction({ richHistoryResults, exploreId }));
        }
    });
};
export const loadMoreRichHistory = (exploreId) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const currentFilters = (_a = getState().explore.panes[exploreId]) === null || _a === void 0 ? void 0 : _a.richHistorySearchFilters;
        const currentRichHistory = (_b = getState().explore.panes[exploreId]) === null || _b === void 0 ? void 0 : _b.richHistory;
        if (currentFilters && currentRichHistory) {
            const nextFilters = Object.assign(Object.assign({}, currentFilters), { page: ((currentFilters === null || currentFilters === void 0 ? void 0 : currentFilters.page) || 1) + 1 });
            const moreRichHistory = yield getRichHistory(nextFilters);
            const richHistory = [...currentRichHistory, ...moreRichHistory.richHistory];
            dispatch(richHistorySearchFiltersUpdatedAction({ filters: nextFilters, exploreId }));
            dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory, total: moreRichHistory.total }, exploreId }));
        }
    });
};
export const clearRichHistoryResults = (exploreId) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        dispatch(richHistorySearchFiltersUpdatedAction({ filters: undefined, exploreId }));
        dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 }, exploreId }));
    });
};
/**
 * Initialize query history pane. To load history it requires settings to be loaded first
 * (but only once per session). Filters are initialised by the tab (starred or home).
 */
export const initRichHistory = () => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        let settings = getState().explore.richHistorySettings;
        if (!settings) {
            settings = yield getRichHistorySettings();
            dispatch(richHistorySettingsUpdatedAction(settings));
        }
    });
};
export const updateHistorySettings = (settings) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        dispatch(richHistorySettingsUpdatedAction(settings));
        yield updateRichHistorySettings(settings);
    });
};
/**
 * Assumed this can be called only when settings and filters are initialised
 */
export const updateHistorySearchFilters = (exploreId, filters) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(richHistorySearchFiltersUpdatedAction({ exploreId, filters: Object.assign({}, filters) }));
        const currentSettings = getState().explore.richHistorySettings;
        if (supportedFeatures().lastUsedDataSourcesAvailable) {
            yield dispatch(updateHistorySettings(Object.assign(Object.assign({}, currentSettings), { lastUsedDatasourceFilters: filters.datasourceFilters })));
        }
    });
};
export const historyReducer = (state, action) => {
    if (historyUpdatedAction.match(action)) {
        return Object.assign(Object.assign({}, state), { history: action.payload.history });
    }
    return state;
};
//# sourceMappingURL=history.js.map