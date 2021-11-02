import { __assign, __awaiter, __generator } from "tslib";
import { isEqual } from 'lodash';
import { DEFAULT_RANGE, getQueryKeys, parseUrlState, ensureQueries, generateNewKeyAndAddRefIdIfMissing, getTimeRangeFromUrl, } from 'app/core/utils/explore';
import { queryReducer, runQueries, setQueriesAction } from './query';
import { datasourceReducer } from './datasource';
import { timeReducer, updateTime } from './time';
import { historyReducer } from './history';
import { makeExplorePaneState, loadAndInitDatasource, createEmptyQueryResponse, getUrlStateFromPaneState, storeGraphStyle, } from './utils';
import { createAction } from '@reduxjs/toolkit';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { getRichHistory } from '../../../core/utils/richHistory';
import { richHistoryUpdatedAction } from './main';
export var changeSizeAction = createAction('explore/changeSize');
export var initializeExploreAction = createAction('explore/initializeExplore');
export var setUrlReplacedAction = createAction('explore/setUrlReplaced');
/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(exploreId, _a) {
    var height = _a.height, width = _a.width;
    return changeSizeAction({ exploreId: exploreId, height: height, width: width });
}
var changeGraphStyleAction = createAction('explore/changeGraphStyle');
export function changeGraphStyle(exploreId, graphStyle) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            storeGraphStyle(graphStyle);
            dispatch(changeGraphStyleAction({ exploreId: exploreId, graphStyle: graphStyle }));
            return [2 /*return*/];
        });
    }); };
}
/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export function initializeExplore(exploreId, datasourceNameOrUid, queries, range, containerWidth, eventBridge, originPanelId) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var exploreDatasources, instance, history, orgId, loadResult, richHistory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    exploreDatasources = getDataSourceSrv().getList();
                    instance = undefined;
                    history = [];
                    if (!(exploreDatasources.length >= 1)) return [3 /*break*/, 2];
                    orgId = getState().user.orgId;
                    return [4 /*yield*/, loadAndInitDatasource(orgId, datasourceNameOrUid)];
                case 1:
                    loadResult = _a.sent();
                    instance = loadResult.instance;
                    history = loadResult.history;
                    _a.label = 2;
                case 2:
                    dispatch(initializeExploreAction({
                        exploreId: exploreId,
                        containerWidth: containerWidth,
                        eventBridge: eventBridge,
                        queries: queries,
                        range: range,
                        originPanelId: originPanelId,
                        datasourceInstance: instance,
                        history: history,
                    }));
                    dispatch(updateTime({ exploreId: exploreId }));
                    if (instance) {
                        // We do not want to add the url to browser history on init because when the pane is initialised it's because
                        // we already have something in the url. Adding basically the same state as additional history item prevents
                        // user to go back to previous url.
                        dispatch(runQueries(exploreId, { replaceUrl: true }));
                    }
                    richHistory = getRichHistory();
                    dispatch(richHistoryUpdatedAction({ richHistory: richHistory }));
                    return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Reacts to changes in URL state that we need to sync back to our redux state. Computes diff of newUrlQuery vs current
 * state and runs update actions for relevant parts.
 */
export function refreshExplore(exploreId, newUrlQuery) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var itemState, newUrlState, update, containerWidth, eventBridge, datasource, queries, urlRange, originPanelId, refreshQueries, index, query, timeZone, fiscalYearStartMonth, range, initialQueries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemState = getState().explore[exploreId];
                    if (!itemState.initialized) {
                        return [2 /*return*/];
                    }
                    newUrlState = parseUrlState(newUrlQuery);
                    update = urlDiff(newUrlState, getUrlStateFromPaneState(itemState));
                    containerWidth = itemState.containerWidth, eventBridge = itemState.eventBridge;
                    datasource = newUrlState.datasource, queries = newUrlState.queries, urlRange = newUrlState.range, originPanelId = newUrlState.originPanelId;
                    refreshQueries = [];
                    for (index = 0; index < queries.length; index++) {
                        query = queries[index];
                        refreshQueries.push(generateNewKeyAndAddRefIdIfMissing(query, refreshQueries, index));
                    }
                    timeZone = getTimeZone(getState().user);
                    fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
                    range = getTimeRangeFromUrl(urlRange, timeZone, fiscalYearStartMonth);
                    if (!update.datasource) return [3 /*break*/, 2];
                    initialQueries = ensureQueries(queries);
                    return [4 /*yield*/, dispatch(initializeExplore(exploreId, datasource, initialQueries, range, containerWidth, eventBridge, originPanelId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    if (update.range) {
                        dispatch(updateTime({ exploreId: exploreId, rawRange: range.raw }));
                    }
                    if (update.queries) {
                        dispatch(setQueriesAction({ exploreId: exploreId, queries: refreshQueries }));
                    }
                    // always run queries when refresh is needed
                    if (update.queries || update.range) {
                        dispatch(runQueries(exploreId));
                    }
                    return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export var paneReducer = function (state, action) {
    if (state === void 0) { state = makeExplorePaneState(); }
    state = queryReducer(state, action);
    state = datasourceReducer(state, action);
    state = timeReducer(state, action);
    state = historyReducer(state, action);
    if (changeSizeAction.match(action)) {
        var containerWidth = action.payload.width;
        return __assign(__assign({}, state), { containerWidth: containerWidth });
    }
    if (changeGraphStyleAction.match(action)) {
        var graphStyle = action.payload.graphStyle;
        return __assign(__assign({}, state), { graphStyle: graphStyle });
    }
    if (initializeExploreAction.match(action)) {
        var _a = action.payload, containerWidth = _a.containerWidth, eventBridge = _a.eventBridge, queries = _a.queries, range = _a.range, originPanelId = _a.originPanelId, datasourceInstance = _a.datasourceInstance, history_1 = _a.history;
        return __assign(__assign({}, state), { containerWidth: containerWidth, eventBridge: eventBridge, range: range, queries: queries, initialized: true, queryKeys: getQueryKeys(queries, datasourceInstance), originPanelId: originPanelId, datasourceInstance: datasourceInstance, history: history_1, datasourceMissing: !datasourceInstance, queryResponse: createEmptyQueryResponse(), cache: [] });
    }
    return state;
};
/**
 * Compare 2 explore urls and return a map of what changed. Used to update the local state with all the
 * side effects needed.
 */
export var urlDiff = function (oldUrlState, currentUrlState) {
    var datasource = !isEqual(currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.datasource, oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.datasource);
    var queries = !isEqual(currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.queries, oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.queries);
    var range = !isEqual((currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.range) || DEFAULT_RANGE, (oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.range) || DEFAULT_RANGE);
    return {
        datasource: datasource,
        queries: queries,
        range: range,
    };
};
//# sourceMappingURL=explorePane.js.map