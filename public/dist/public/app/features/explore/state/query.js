import { __assign, __awaiter, __generator, __read, __rest, __spreadArray } from "tslib";
import { mergeMap, throttleTime } from 'rxjs/operators';
import { identity, of } from 'rxjs';
import { DataQueryErrorType, hasLogsVolumeSupport, LoadingState, PanelEvents, toLegacyResponseData, } from '@grafana/data';
import { buildQueryTransaction, ensureQueries, generateEmptyQuery, generateNewKeyAndAddRefIdIfMissing, getQueryKeys, hasNonEmptyQuery, stopQueryState, updateHistory, } from 'app/core/utils/explore';
import { addToRichHistory } from 'app/core/utils/richHistory';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';
import { notifyApp } from '../../../core/actions';
import { runRequest } from '../../query/state/runRequest';
import { decorateData } from '../utils/decorators';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { localStorageFullAction, richHistoryLimitExceededAction, richHistoryUpdatedAction, stateSave } from './main';
import { createAction } from '@reduxjs/toolkit';
import { updateTime } from './time';
import { historyUpdatedAction } from './history';
import { createCacheKey, createEmptyQueryResponse, getResultsFromCache } from './utils';
import { config } from '@grafana/runtime';
import deepEqual from 'fast-deep-equal';
export var addQueryRowAction = createAction('explore/addQueryRow');
export var changeQueriesAction = createAction('explore/changeQueries');
export var clearQueriesAction = createAction('explore/clearQueries');
/**
 * Cancel running queries.
 */
export var cancelQueriesAction = createAction('explore/cancelQueries');
export var queriesImportedAction = createAction('explore/queriesImported');
export var modifyQueriesAction = createAction('explore/modifyQueries');
export var queryStoreSubscriptionAction = createAction('explore/queryStoreSubscription');
/**
 * Stores available logs volume provider after running the query. Used internally by runQueries().
 */
var storeLogsVolumeDataProviderAction = createAction('explore/storeLogsVolumeDataProviderAction');
var cleanLogsVolumeAction = createAction('explore/cleanLogsVolumeAction');
/**
 * Stores current logs volume subscription for given explore pane.
 */
var storeLogsVolumeDataSubscriptionAction = createAction('explore/storeLogsVolumeDataSubscriptionAction');
/**
 * Stores data returned by the provider. Used internally by loadLogsVolumeData().
 */
var updateLogsVolumeDataAction = createAction('explore/updateLogsVolumeDataAction');
export var queryStreamUpdatedAction = createAction('explore/queryStreamUpdated');
export var setQueriesAction = createAction('explore/setQueries');
export var changeLoadingStateAction = createAction('changeLoadingState');
export var setPausedStateAction = createAction('explore/setPausedState');
export var scanStartAction = createAction('explore/scanStart');
export var scanStopAction = createAction('explore/scanStop');
export var addResultsToCacheAction = createAction('explore/addResultsToCache');
export var clearCacheAction = createAction('explore/clearCache');
//
// Action creators
//
/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId, index) {
    return function (dispatch, getState) {
        var queries = getState().explore[exploreId].queries;
        var query = generateEmptyQuery(queries, index);
        dispatch(addQueryRowAction({ exploreId: exploreId, index: index, query: query }));
    };
}
/**
 * Clear all queries and results.
 */
export function clearQueries(exploreId) {
    return function (dispatch) {
        dispatch(scanStopAction({ exploreId: exploreId }));
        dispatch(clearQueriesAction({ exploreId: exploreId }));
        dispatch(stateSave());
    };
}
/**
 * Cancel running queries
 */
export function cancelQueries(exploreId) {
    return function (dispatch) {
        dispatch(scanStopAction({ exploreId: exploreId }));
        dispatch(cancelQueriesAction({ exploreId: exploreId }));
        dispatch(stateSave());
    };
}
/**
 * Import queries from previous datasource if possible eg Loki and Prometheus have similar query language so the
 * labels part can be reused to get similar data.
 * @param exploreId
 * @param queries
 * @param sourceDataSource
 * @param targetDataSource
 */
export var importQueries = function (exploreId, queries, sourceDataSource, targetDataSource) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        var importedQueries, nextQueries;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!sourceDataSource) {
                        // explore not initialized
                        dispatch(queriesImportedAction({ exploreId: exploreId, queries: queries }));
                        return [2 /*return*/];
                    }
                    importedQueries = queries;
                    if (!(((_a = sourceDataSource.meta) === null || _a === void 0 ? void 0 : _a.id) === ((_b = targetDataSource.meta) === null || _b === void 0 ? void 0 : _b.id))) return [3 /*break*/, 1];
                    // Keep same queries if same type of datasource, but delete datasource query property to prevent mismatch of new and old data source instance
                    importedQueries = queries.map(function (_a) {
                        var datasource = _a.datasource, query = __rest(_a, ["datasource"]);
                        return query;
                    });
                    return [3 /*break*/, 4];
                case 1:
                    if (!targetDataSource.importQueries) return [3 /*break*/, 3];
                    return [4 /*yield*/, targetDataSource.importQueries(queries, sourceDataSource)];
                case 2:
                    // Datasource-specific importers
                    importedQueries = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    // Default is blank queries
                    importedQueries = ensureQueries();
                    _c.label = 4;
                case 4:
                    nextQueries = ensureQueries(importedQueries);
                    dispatch(queriesImportedAction({ exploreId: exploreId, queries: nextQueries }));
                    return [2 /*return*/];
            }
        });
    }); };
};
/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(exploreId, modification, modifier, index) {
    return function (dispatch) {
        dispatch(modifyQueriesAction({ exploreId: exploreId, modification: modification, index: index, modifier: modifier }));
        if (!modification.preventSubmit) {
            dispatch(runQueries(exploreId));
        }
    };
}
/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export var runQueries = function (exploreId, options) {
    return function (dispatch, getState) {
        dispatch(updateTime({ exploreId: exploreId }));
        // We always want to clear cache unless we explicitly pass preserveCache parameter
        var preserveCache = (options === null || options === void 0 ? void 0 : options.preserveCache) === true;
        if (!preserveCache) {
            dispatch(clearCache(exploreId));
        }
        var richHistory = getState().explore.richHistory;
        var exploreItemState = getState().explore[exploreId];
        var datasourceInstance = exploreItemState.datasourceInstance, containerWidth = exploreItemState.containerWidth, live = exploreItemState.isLive, range = exploreItemState.range, scanning = exploreItemState.scanning, queryResponse = exploreItemState.queryResponse, querySubscription = exploreItemState.querySubscription, history = exploreItemState.history, refreshInterval = exploreItemState.refreshInterval, absoluteRange = exploreItemState.absoluteRange, cache = exploreItemState.cache, logsVolumeDataProvider = exploreItemState.logsVolumeDataProvider;
        var newQuerySub;
        var queries = exploreItemState.queries.map(function (query) { return (__assign(__assign({}, query), { datasource: query.datasource || (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.getRef()) })); });
        var cachedValue = getResultsFromCache(cache, absoluteRange);
        // If we have results saved in cache, we are going to use those results instead of running queries
        if (cachedValue) {
            newQuerySub = of(cachedValue)
                .pipe(mergeMap(function (data) {
                return decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, !!logsVolumeDataProvider);
            }))
                .subscribe(function (data) {
                if (!data.error) {
                    dispatch(stateSave());
                }
                dispatch(queryStreamUpdatedAction({ exploreId: exploreId, response: data }));
            });
            // If we don't have results saved in cache, run new queries
        }
        else {
            if (!hasNonEmptyQuery(queries)) {
                dispatch(stateSave({ replace: options === null || options === void 0 ? void 0 : options.replaceUrl })); // Remember to save to state and update location
                return;
            }
            if (!datasourceInstance) {
                return;
            }
            // Some datasource's query builders allow per-query interval limits,
            // but we're using the datasource interval limit for now
            var minInterval = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.interval;
            stopQueryState(querySubscription);
            var datasourceId_1 = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.meta.id;
            var queryOptions = {
                minInterval: minInterval,
                // maxDataPoints is used in:
                // Loki - used for logs streaming for buffer size, with undefined it falls back to datasource config if it supports that.
                // Elastic - limits the number of datapoints for the counts query and for logs it has hardcoded limit.
                // Influx - used to correctly display logs in graph
                // TODO:unification
                // maxDataPoints: mode === ExploreMode.Logs && datasourceId === 'loki' ? undefined : containerWidth,
                maxDataPoints: containerWidth,
                liveStreaming: live,
            };
            var datasourceName_1 = datasourceInstance.name;
            var timeZone = getTimeZone(getState().user);
            var transaction = buildQueryTransaction(exploreId, queries, queryOptions, range, scanning, timeZone);
            var firstResponse_1 = true;
            dispatch(changeLoadingStateAction({ exploreId: exploreId, loadingState: LoadingState.Loading }));
            newQuerySub = runRequest(datasourceInstance, transaction.request)
                .pipe(
            // Simple throttle for live tailing, in case of > 1000 rows per interval we spend about 200ms on processing and
            // rendering. In case this is optimized this can be tweaked, but also it should be only as fast as user
            // actually can see what is happening.
            live ? throttleTime(500) : identity, mergeMap(function (data) {
                return decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, !!getState().explore[exploreId].logsVolumeDataProvider);
            }))
                .subscribe(function (data) {
                if (!data.error && firstResponse_1) {
                    // Side-effect: Saving history in localstorage
                    var nextHistory = updateHistory(history, datasourceId_1, queries);
                    var _a = addToRichHistory(richHistory || [], datasourceId_1, datasourceName_1, queries, false, '', '', !getState().explore.localStorageFull, !getState().explore.richHistoryLimitExceededWarningShown), nextRichHistory = _a.richHistory, localStorageFull = _a.localStorageFull, limitExceeded = _a.limitExceeded;
                    dispatch(historyUpdatedAction({ exploreId: exploreId, history: nextHistory }));
                    dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
                    if (localStorageFull) {
                        dispatch(localStorageFullAction());
                    }
                    if (limitExceeded) {
                        dispatch(richHistoryLimitExceededAction());
                    }
                    // We save queries to the URL here so that only successfully run queries change the URL.
                    dispatch(stateSave({ replace: options === null || options === void 0 ? void 0 : options.replaceUrl }));
                }
                firstResponse_1 = false;
                dispatch(queryStreamUpdatedAction({ exploreId: exploreId, response: data }));
                // Keep scanning for results if this was the last scanning transaction
                if (getState().explore[exploreId].scanning) {
                    if (data.state === LoadingState.Done && data.series.length === 0) {
                        var range_1 = getShiftedTimeRange(-1, getState().explore[exploreId].range);
                        dispatch(updateTime({ exploreId: exploreId, absoluteRange: range_1 }));
                        dispatch(runQueries(exploreId));
                    }
                    else {
                        // We can stop scanning if we have a result
                        dispatch(scanStopAction({ exploreId: exploreId }));
                    }
                }
            }, function (error) {
                dispatch(notifyApp(createErrorNotification('Query processing error', error)));
                dispatch(changeLoadingStateAction({ exploreId: exploreId, loadingState: LoadingState.Error }));
                console.error(error);
            });
            if (live) {
                dispatch(storeLogsVolumeDataProviderAction({
                    exploreId: exploreId,
                    logsVolumeDataProvider: undefined,
                }));
                dispatch(cleanLogsVolumeAction({ exploreId: exploreId }));
            }
            else if (config.featureToggles.fullRangeLogsVolume && hasLogsVolumeSupport(datasourceInstance)) {
                var logsVolumeDataProvider_1 = datasourceInstance.getLogsVolumeDataProvider(transaction.request);
                dispatch(storeLogsVolumeDataProviderAction({
                    exploreId: exploreId,
                    logsVolumeDataProvider: logsVolumeDataProvider_1,
                }));
                var _a = getState().explore[exploreId], logsVolumeData = _a.logsVolumeData, absoluteRange_1 = _a.absoluteRange;
                if (!canReuseLogsVolumeData(logsVolumeData, queries, absoluteRange_1)) {
                    dispatch(cleanLogsVolumeAction({ exploreId: exploreId }));
                    if (config.featureToggles.autoLoadFullRangeLogsVolume) {
                        dispatch(loadLogsVolumeData(exploreId));
                    }
                }
            }
            else {
                dispatch(storeLogsVolumeDataProviderAction({
                    exploreId: exploreId,
                    logsVolumeDataProvider: undefined,
                }));
            }
        }
        dispatch(queryStoreSubscriptionAction({ exploreId: exploreId, querySubscription: newQuerySub }));
    };
};
/**
 * Checks if after changing the time range the existing data can be used to show logs volume.
 * It can happen if queries are the same and new time range is within existing data time range.
 */
function canReuseLogsVolumeData(logsVolumeData, queries, selectedTimeRange) {
    var _a, _b, _c, _d;
    if (logsVolumeData && logsVolumeData.data[0]) {
        // check if queries are the same
        if (!deepEqual((_b = (_a = logsVolumeData.data[0].meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.targets, queries)) {
            return false;
        }
        var dataRange = logsVolumeData && logsVolumeData.data[0] && ((_d = (_c = logsVolumeData.data[0].meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.absoluteRange);
        // if selected range is within loaded logs volume
        if (dataRange && dataRange.from <= selectedTimeRange.from && selectedTimeRange.to <= dataRange.to) {
            return true;
        }
    }
    return false;
}
/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId, rawQueries) {
    return function (dispatch, getState) {
        // Inject react keys into query objects
        var queries = getState().explore[exploreId].queries;
        var nextQueries = rawQueries.map(function (query, index) { return generateNewKeyAndAddRefIdIfMissing(query, queries, index); });
        dispatch(setQueriesAction({ exploreId: exploreId, queries: nextQueries }));
        dispatch(runQueries(exploreId));
    };
}
/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId) {
    return function (dispatch, getState) {
        // Register the scanner
        dispatch(scanStartAction({ exploreId: exploreId }));
        // Scanning must trigger query run, and return the new range
        var range = getShiftedTimeRange(-1, getState().explore[exploreId].range);
        // Set the new range to be displayed
        dispatch(updateTime({ exploreId: exploreId, absoluteRange: range }));
        dispatch(runQueries(exploreId));
    };
}
export function addResultsToCache(exploreId) {
    return function (dispatch, getState) {
        var queryResponse = getState().explore[exploreId].queryResponse;
        var absoluteRange = getState().explore[exploreId].absoluteRange;
        var cacheKey = createCacheKey(absoluteRange);
        // Save results to cache only when all results recived and loading is done
        if (queryResponse.state === LoadingState.Done) {
            dispatch(addResultsToCacheAction({ exploreId: exploreId, cacheKey: cacheKey, queryResponse: queryResponse }));
        }
    };
}
export function clearCache(exploreId) {
    return function (dispatch, getState) {
        dispatch(clearCacheAction({ exploreId: exploreId }));
    };
}
/**
 * Initializes loading logs volume data and stores emitted value.
 */
export function loadLogsVolumeData(exploreId) {
    return function (dispatch, getState) {
        var logsVolumeDataProvider = getState().explore[exploreId].logsVolumeDataProvider;
        if (logsVolumeDataProvider) {
            var logsVolumeDataSubscription = logsVolumeDataProvider.subscribe({
                next: function (logsVolumeData) {
                    dispatch(updateLogsVolumeDataAction({ exploreId: exploreId, logsVolumeData: logsVolumeData }));
                },
            });
            dispatch(storeLogsVolumeDataSubscriptionAction({ exploreId: exploreId, logsVolumeDataSubscription: logsVolumeDataSubscription }));
        }
    };
}
//
// Reducer
//
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export var queryReducer = function (state, action) {
    if (addQueryRowAction.match(action)) {
        var queries = state.queries;
        var _a = action.payload, index = _a.index, query = _a.query;
        // Add to queries, which will cause a new row to be rendered
        var nextQueries = __spreadArray(__spreadArray(__spreadArray([], __read(queries.slice(0, index + 1)), false), [__assign({}, query)], false), __read(queries.slice(index + 1)), false);
        return __assign(__assign({}, state), { queries: nextQueries, queryKeys: getQueryKeys(nextQueries, state.datasourceInstance) });
    }
    if (changeQueriesAction.match(action)) {
        var queries = action.payload.queries;
        return __assign(__assign({}, state), { queries: queries });
    }
    if (clearQueriesAction.match(action)) {
        var queries = ensureQueries();
        stopQueryState(state.querySubscription);
        return __assign(__assign({}, state), { queries: queries.slice(), graphResult: null, tableResult: null, logsResult: null, queryKeys: getQueryKeys(queries, state.datasourceInstance), queryResponse: createEmptyQueryResponse(), loading: false });
    }
    if (cancelQueriesAction.match(action)) {
        stopQueryState(state.querySubscription);
        return __assign(__assign({}, state), { loading: false });
    }
    if (modifyQueriesAction.match(action)) {
        var queries_1 = state.queries;
        var _b = action.payload, modification_1 = _b.modification, index_1 = _b.index, modifier_1 = _b.modifier;
        var nextQueries = void 0;
        if (index_1 === undefined) {
            // Modify all queries
            nextQueries = queries_1.map(function (query, i) {
                var nextQuery = modifier_1(__assign({}, query), modification_1);
                return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries_1, i);
            });
        }
        else {
            // Modify query only at index
            nextQueries = queries_1.map(function (query, i) {
                if (i === index_1) {
                    var nextQuery = modifier_1(__assign({}, query), modification_1);
                    return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries_1, i);
                }
                return query;
            });
        }
        return __assign(__assign({}, state), { queries: nextQueries, queryKeys: getQueryKeys(nextQueries, state.datasourceInstance) });
    }
    if (setQueriesAction.match(action)) {
        var queries = action.payload.queries;
        return __assign(__assign({}, state), { queries: queries.slice(), queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    }
    if (queriesImportedAction.match(action)) {
        var queries = action.payload.queries;
        return __assign(__assign({}, state), { queries: queries, queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    }
    if (queryStoreSubscriptionAction.match(action)) {
        var querySubscription = action.payload.querySubscription;
        return __assign(__assign({}, state), { querySubscription: querySubscription });
    }
    if (storeLogsVolumeDataProviderAction.match(action)) {
        var logsVolumeDataProvider = action.payload.logsVolumeDataProvider;
        if (state.logsVolumeDataSubscription) {
            state.logsVolumeDataSubscription.unsubscribe();
        }
        return __assign(__assign({}, state), { logsVolumeDataProvider: logsVolumeDataProvider, logsVolumeDataSubscription: undefined });
    }
    if (cleanLogsVolumeAction.match(action)) {
        return __assign(__assign({}, state), { logsVolumeData: undefined });
    }
    if (storeLogsVolumeDataSubscriptionAction.match(action)) {
        var logsVolumeDataSubscription = action.payload.logsVolumeDataSubscription;
        return __assign(__assign({}, state), { logsVolumeDataSubscription: logsVolumeDataSubscription });
    }
    if (updateLogsVolumeDataAction.match(action)) {
        var logsVolumeData = action.payload.logsVolumeData;
        return __assign(__assign({}, state), { logsVolumeData: logsVolumeData });
    }
    if (queryStreamUpdatedAction.match(action)) {
        return processQueryResponse(state, action);
    }
    if (queriesImportedAction.match(action)) {
        var queries = action.payload.queries;
        return __assign(__assign({}, state), { queries: queries, queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    }
    if (changeLoadingStateAction.match(action)) {
        var loadingState = action.payload.loadingState;
        return __assign(__assign({}, state), { queryResponse: __assign(__assign({}, state.queryResponse), { state: loadingState }), loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming });
    }
    if (setPausedStateAction.match(action)) {
        var isPaused = action.payload.isPaused;
        return __assign(__assign({}, state), { isPaused: isPaused });
    }
    if (scanStartAction.match(action)) {
        return __assign(__assign({}, state), { scanning: true });
    }
    if (scanStopAction.match(action)) {
        return __assign(__assign({}, state), { scanning: false, scanRange: undefined });
    }
    if (addResultsToCacheAction.match(action)) {
        var CACHE_LIMIT = 5;
        var cache = state.cache;
        var _c = action.payload, queryResponse = _c.queryResponse, cacheKey_1 = _c.cacheKey;
        var newCache = __spreadArray([], __read(cache), false);
        var isDuplicateKey = newCache.some(function (c) { return c.key === cacheKey_1; });
        if (!isDuplicateKey) {
            var newCacheItem = { key: cacheKey_1, value: queryResponse };
            newCache = __spreadArray([newCacheItem], __read(newCache), false).slice(0, CACHE_LIMIT);
        }
        return __assign(__assign({}, state), { cache: newCache });
    }
    if (clearCacheAction.match(action)) {
        return __assign(__assign({}, state), { cache: [] });
    }
    return state;
};
export var processQueryResponse = function (state, action) {
    var _a, _b, _c, _d;
    var response = action.payload.response;
    var request = response.request, loadingState = response.state, series = response.series, error = response.error, graphResult = response.graphResult, logsResult = response.logsResult, tableResult = response.tableResult, traceFrames = response.traceFrames, nodeGraphFrames = response.nodeGraphFrames;
    if (error) {
        if (error.type === DataQueryErrorType.Timeout) {
            return __assign(__assign({}, state), { queryResponse: response, loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming });
        }
        else if (error.type === DataQueryErrorType.Cancelled) {
            return state;
        }
        // Send error to Angular editors
        if ((_b = (_a = state.datasourceInstance) === null || _a === void 0 ? void 0 : _a.components) === null || _b === void 0 ? void 0 : _b.QueryCtrl) {
            state.eventBridge.emit(PanelEvents.dataError, error);
        }
    }
    if (!request) {
        return __assign({}, state);
    }
    // Send legacy data to Angular editors
    if ((_d = (_c = state.datasourceInstance) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.QueryCtrl) {
        var legacy = series.map(function (v) { return toLegacyResponseData(v); });
        state.eventBridge.emit(PanelEvents.dataReceived, legacy);
    }
    return __assign(__assign({}, state), { queryResponse: response, graphResult: graphResult, tableResult: tableResult, logsResult: logsResult, loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming, showLogs: !!logsResult, showMetrics: !!graphResult, showTable: !!tableResult, showTrace: !!traceFrames.length, showNodeGraph: !!nodeGraphFrames.length });
};
//# sourceMappingURL=query.js.map