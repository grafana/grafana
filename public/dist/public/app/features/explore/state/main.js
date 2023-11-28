import { __awaiter, __rest } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { locationService } from '@grafana/runtime';
import { generateExploreId } from 'app/core/utils/explore';
import { createAsyncThunk } from '../../../types';
import { withUniqueRefIds } from '../utils/queries';
import { initializeExplore, paneReducer } from './explorePane';
import { DEFAULT_RANGE, makeExplorePaneState } from './utils';
export const syncTimesAction = createAction('explore/syncTimes');
export const richHistoryUpdatedAction = createAction('explore/richHistoryUpdated');
export const richHistoryStorageFullAction = createAction('explore/richHistoryStorageFullAction');
export const richHistoryLimitExceededAction = createAction('explore/richHistoryLimitExceededAction');
export const richHistorySettingsUpdatedAction = createAction('explore/richHistorySettingsUpdated');
export const richHistorySearchFiltersUpdatedAction = createAction('explore/richHistorySearchFiltersUpdatedAction');
export const splitSizeUpdateAction = createAction('explore/splitSizeUpdateAction');
export const maximizePaneAction = createAction('explore/maximizePaneAction');
export const evenPaneResizeAction = createAction('explore/evenPaneResizeAction');
/**
 * Close the pane with the given id.
 */
export const splitClose = createAction('explore/splitClose');
export const setPaneState = createAction('explore/setPaneState');
export const clearPanes = createAction('explore/clearPanes');
/**
 * Ensure Explore doesn't exceed supported number of panes and initializes the new pane.
 */
export const splitOpen = createAsyncThunk('explore/splitOpen', (options, { getState, dispatch, requestId }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // we currently support showing only 2 panes in explore, so if this action is dispatched we know it has been dispatched from the "first" pane.
    const originState = Object.values(getState().explore.panes)[0];
    const queries = (_a = options === null || options === void 0 ? void 0 : options.queries) !== null && _a !== void 0 ? _a : ((options === null || options === void 0 ? void 0 : options.query) ? [options === null || options === void 0 ? void 0 : options.query] : (originState === null || originState === void 0 ? void 0 : originState.queries) || []);
    Object.keys(getState().explore.panes).forEach((paneId, index) => {
        // Only 2 panes are supported. Remove panes before create a new one.
        if (index >= 1) {
            dispatch(splitClose(paneId));
        }
    });
    yield dispatch(createNewSplitOpenPane({
        exploreId: requestId,
        datasource: (options === null || options === void 0 ? void 0 : options.datasourceUid) || ((_b = originState === null || originState === void 0 ? void 0 : originState.datasourceInstance) === null || _b === void 0 ? void 0 : _b.getRef()),
        queries: withUniqueRefIds(queries),
        range: (options === null || options === void 0 ? void 0 : options.range) || (originState === null || originState === void 0 ? void 0 : originState.range.raw) || DEFAULT_RANGE,
        panelsState: (options === null || options === void 0 ? void 0 : options.panelsState) || (originState === null || originState === void 0 ? void 0 : originState.panelsState),
        correlationHelperData: options === null || options === void 0 ? void 0 : options.correlationHelperData,
    }));
}), {
    idGenerator: generateExploreId,
});
/**
 * Opens a new split pane. It either copies existing state of an already present pane
 * or uses values from options arg.
 *
 * TODO: this can be improved by better inferring fallback values.
 */
const createNewSplitOpenPane = createAsyncThunk('explore/createNewSplitOpen', (options, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield dispatch(initializeExplore(options));
}));
/**
 * Moves explore into and out of correlations editor mode
 */
export const changeCorrelationEditorDetails = createAction('explore/changeCorrelationEditorDetails');
export const navigateToExplore = (panel, dependencies) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const { timeRange, getExploreUrl, openInNewWindow } = dependencies;
        const path = yield getExploreUrl({
            queries: panel.targets,
            dsRef: panel.datasource,
            scopedVars: panel.scopedVars,
            timeRange,
        });
        if (openInNewWindow && path) {
            openInNewWindow(path);
            return;
        }
        locationService.push(path);
    });
};
/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
const initialExploreItemState = makeExplorePaneState();
export const initialExploreState = {
    syncedTimes: false,
    panes: {},
    correlationEditorDetails: { editorMode: false, dirty: false, isExiting: false },
    richHistoryStorageFull: false,
    richHistoryLimitExceededWarningShown: false,
    largerExploreId: undefined,
    maxedExploreId: undefined,
    evenSplitPanes: true,
};
/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (splitClose.match(action)) {
        const _h = Object.assign({}, state.panes), _j = action.payload, _ = _h[_j], panes = __rest(_h, [typeof _j === "symbol" ? _j : _j + ""]);
        return Object.assign(Object.assign({}, state), { panes, largerExploreId: undefined, maxedExploreId: undefined, evenSplitPanes: true, syncedTimes: false });
    }
    if (splitSizeUpdateAction.match(action)) {
        const { largerExploreId } = action.payload;
        return Object.assign(Object.assign({}, state), { largerExploreId, maxedExploreId: undefined, evenSplitPanes: largerExploreId === undefined });
    }
    if (maximizePaneAction.match(action)) {
        const { exploreId } = action.payload;
        return Object.assign(Object.assign({}, state), { largerExploreId: exploreId, maxedExploreId: exploreId, evenSplitPanes: false });
    }
    if (evenPaneResizeAction.match(action)) {
        return Object.assign(Object.assign({}, state), { largerExploreId: undefined, maxedExploreId: undefined, evenSplitPanes: true });
    }
    if (syncTimesAction.match(action)) {
        return Object.assign(Object.assign({}, state), { syncedTimes: action.payload.syncedTimes });
    }
    if (richHistoryStorageFullAction.match(action)) {
        return Object.assign(Object.assign({}, state), { richHistoryStorageFull: true });
    }
    if (richHistoryLimitExceededAction.match(action)) {
        return Object.assign(Object.assign({}, state), { richHistoryLimitExceededWarningShown: true });
    }
    if (richHistorySettingsUpdatedAction.match(action)) {
        const richHistorySettings = action.payload;
        return Object.assign(Object.assign({}, state), { richHistorySettings });
    }
    if (createNewSplitOpenPane.pending.match(action)) {
        return Object.assign(Object.assign({}, state), { panes: Object.assign(Object.assign({}, state.panes), { [action.meta.arg.exploreId]: initialExploreItemState }) });
    }
    if (initializeExplore.pending.match(action)) {
        const initialPanes = Object.entries(state.panes);
        const before = initialPanes.slice(0, action.meta.arg.position);
        const after = initialPanes.slice(before.length);
        const panes = [...before, [action.meta.arg.exploreId, initialExploreItemState], ...after].reduce((acc, [id, pane]) => (Object.assign(Object.assign({}, acc), { [id]: pane })), {});
        return Object.assign(Object.assign({}, state), { panes });
    }
    if (clearPanes.match(action)) {
        return Object.assign(Object.assign({}, state), { panes: {} });
    }
    if (changeCorrelationEditorDetails.match(action)) {
        const { editorMode, label, description, canSave, dirty, isExiting, postConfirmAction } = action.payload;
        return Object.assign(Object.assign({}, state), { correlationEditorDetails: {
                editorMode: Boolean(editorMode !== null && editorMode !== void 0 ? editorMode : (_a = state.correlationEditorDetails) === null || _a === void 0 ? void 0 : _a.editorMode),
                canSave: Boolean(canSave !== null && canSave !== void 0 ? canSave : (_b = state.correlationEditorDetails) === null || _b === void 0 ? void 0 : _b.canSave),
                label: label !== null && label !== void 0 ? label : (_c = state.correlationEditorDetails) === null || _c === void 0 ? void 0 : _c.label,
                description: description !== null && description !== void 0 ? description : (_d = state.correlationEditorDetails) === null || _d === void 0 ? void 0 : _d.description,
                dirty: Boolean(dirty !== null && dirty !== void 0 ? dirty : (_e = state.correlationEditorDetails) === null || _e === void 0 ? void 0 : _e.dirty),
                isExiting: Boolean(isExiting !== null && isExiting !== void 0 ? isExiting : (_f = state.correlationEditorDetails) === null || _f === void 0 ? void 0 : _f.isExiting),
                postConfirmAction,
            } });
    }
    const exploreId = (_g = action.payload) === null || _g === void 0 ? void 0 : _g.exploreId;
    if (typeof exploreId === 'string') {
        return Object.assign(Object.assign({}, state), { panes: Object.entries(state.panes).reduce((acc, [id, pane]) => {
                return Object.assign(Object.assign({}, acc), { [id]: id === exploreId ? paneReducer(pane, action) : pane });
            }, {}) });
    }
    return state;
};
export default {
    explore: exploreReducer,
};
//# sourceMappingURL=main.js.map