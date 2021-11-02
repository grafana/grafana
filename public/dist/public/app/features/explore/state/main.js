import { __assign, __awaiter, __generator } from "tslib";
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { serializeStateToUrlParam } from '@grafana/data';
import { stopQueryState } from 'app/core/utils/explore';
import { ExploreId } from 'app/types/explore';
import { paneReducer } from './explorePane';
import { createAction } from '@reduxjs/toolkit';
import { getUrlStateFromPaneState, makeExplorePaneState } from './utils';
export var syncTimesAction = createAction('explore/syncTimes');
export var richHistoryUpdatedAction = createAction('explore/richHistoryUpdated');
export var localStorageFullAction = createAction('explore/localStorageFullAction');
export var richHistoryLimitExceededAction = createAction('explore/richHistoryLimitExceededAction');
export var resetExploreAction = createAction('explore/resetExplore');
export var splitCloseAction = createAction('explore/splitClose');
export var cleanupPaneAction = createAction('explore/cleanupPane');
//
// Action creators
//
/**
 * Save local redux state back to the URL. Should be called when there is some change that should affect the URL.
 * Not all of the redux state is reflected in URL though.
 */
export var stateSave = function (options) {
    return function (dispatch, getState) {
        var _a = getState().explore, left = _a.left, right = _a.right;
        var orgId = getState().user.orgId.toString();
        var urlStates = { orgId: orgId };
        urlStates.left = serializeStateToUrlParam(getUrlStateFromPaneState(left), true);
        if (right) {
            urlStates.right = serializeStateToUrlParam(getUrlStateFromPaneState(right), true);
        }
        else {
            urlStates.right = null;
        }
        lastSavedUrl.right = urlStates.right;
        lastSavedUrl.left = urlStates.left;
        locationService.partial(__assign({}, urlStates), options === null || options === void 0 ? void 0 : options.replace);
    };
};
// Store the url we saved last se we are not trying to update local state based on that.
export var lastSavedUrl = {};
/**
 * Opens a new right split pane by navigating to appropriate URL. It either copies existing state of the left pane
 * or uses values from options arg. This does only navigation each pane is then responsible for initialization from
 * the URL.
 */
export function splitOpen(options) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var leftState, leftUrlState, rightUrlState, datasourceName, urlState;
        var _a;
        return __generator(this, function (_b) {
            leftState = getState().explore[ExploreId.left];
            leftUrlState = getUrlStateFromPaneState(leftState);
            rightUrlState = leftUrlState;
            if (options) {
                datasourceName = ((_a = getDataSourceSrv().getInstanceSettings(options.datasourceUid)) === null || _a === void 0 ? void 0 : _a.name) || '';
                rightUrlState = {
                    datasource: datasourceName,
                    queries: [options.query],
                    range: options.range || leftState.range,
                };
            }
            urlState = serializeStateToUrlParam(rightUrlState, true);
            locationService.partial({ right: urlState }, true);
            return [2 /*return*/];
        });
    }); };
}
/**
 * Close the split view and save URL state. We need to update the state here because when closing we cannot just
 * update the URL and let the components handle it because if we swap panes from right to left it is not easily apparent
 * from the URL.
 */
export function splitClose(itemId) {
    return function (dispatch, getState) {
        dispatch(splitCloseAction({ itemId: itemId }));
        dispatch(stateSave());
    };
}
export var navigateToExplore = function (panel, dependencies) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        var getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow, datasourceSrv, path;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getDataSourceSrv = dependencies.getDataSourceSrv, getTimeSrv = dependencies.getTimeSrv, getExploreUrl = dependencies.getExploreUrl, openInNewWindow = dependencies.openInNewWindow;
                    datasourceSrv = getDataSourceSrv();
                    return [4 /*yield*/, getExploreUrl({
                            panel: panel,
                            datasourceSrv: datasourceSrv,
                            timeSrv: getTimeSrv(),
                        })];
                case 1:
                    path = _a.sent();
                    if (openInNewWindow && path) {
                        openInNewWindow(path);
                        return [2 /*return*/];
                    }
                    locationService.push(path);
                    return [2 /*return*/];
            }
        });
    }); };
};
/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
var initialExploreItemState = makeExplorePaneState();
export var initialExploreState = {
    syncedTimes: false,
    left: initialExploreItemState,
    right: undefined,
    richHistory: [],
    localStorageFull: false,
    richHistoryLimitExceededWarningShown: false,
};
/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export var exploreReducer = function (state, action) {
    var _a, _b, _c;
    var _d;
    if (state === void 0) { state = initialExploreState; }
    if (splitCloseAction.match(action)) {
        var itemId = action.payload.itemId;
        var targetSplit = {
            left: itemId === ExploreId.left ? state.right : state.left,
            right: undefined,
        };
        return __assign(__assign({}, state), targetSplit);
    }
    if (cleanupPaneAction.match(action)) {
        var exploreId = action.payload.exploreId;
        // We want to do this only when we remove single pane not when we are unmounting whole explore.
        // It needs to be checked like this because in component we don't get new path (which would tell us if we are
        // navigating out of explore) before the unmount.
        if (!((_d = state[exploreId]) === null || _d === void 0 ? void 0 : _d.initialized)) {
            return state;
        }
        if (exploreId === ExploreId.left) {
            return __assign(__assign({}, state), (_a = {}, _a[ExploreId.left] = state[ExploreId.right], _a[ExploreId.right] = undefined, _a));
        }
        else {
            return __assign(__assign({}, state), (_b = {}, _b[ExploreId.right] = undefined, _b));
        }
    }
    if (syncTimesAction.match(action)) {
        return __assign(__assign({}, state), { syncedTimes: action.payload.syncedTimes });
    }
    if (richHistoryUpdatedAction.match(action)) {
        return __assign(__assign({}, state), { richHistory: action.payload.richHistory });
    }
    if (localStorageFullAction.match(action)) {
        return __assign(__assign({}, state), { localStorageFull: true });
    }
    if (richHistoryLimitExceededAction.match(action)) {
        return __assign(__assign({}, state), { richHistoryLimitExceededWarningShown: true });
    }
    if (resetExploreAction.match(action)) {
        var payload = action.payload;
        var leftState = state[ExploreId.left];
        var rightState = state[ExploreId.right];
        stopQueryState(leftState.querySubscription);
        if (rightState) {
            stopQueryState(rightState.querySubscription);
        }
        if (payload.force || !Number.isInteger(state.left.originPanelId)) {
            return initialExploreState;
        }
        return __assign(__assign({}, initialExploreState), { left: __assign(__assign({}, initialExploreItemState), { queries: state.left.queries, originPanelId: state.left.originPanelId }) });
    }
    if (action.payload) {
        var exploreId = action.payload.exploreId;
        if (exploreId !== undefined) {
            // @ts-ignore
            var explorePaneState = state[exploreId];
            return __assign(__assign({}, state), (_c = {}, _c[exploreId] = paneReducer(explorePaneState, action), _c));
        }
    }
    return state;
};
export default {
    explore: exploreReducer,
};
//# sourceMappingURL=main.js.map