import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
// Services & Utils
import store from 'app/core/store';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { LAST_USED_DATASOURCE_KEY, clearQueryKeys, ensureQueries, generateEmptyQuery, hasNonEmptyQuery, makeTimeSeriesList, updateHistory, buildQueryTransaction, serializeStateToUrlParam, } from 'app/core/utils/explore';
// Actions
import { updateLocation } from 'app/core/actions';
import { updateDatasourceInstanceAction, changeQueryAction, changeSizeAction, changeTimeAction, scanStopAction, clearQueriesAction, initializeExploreAction, loadDatasourceMissingAction, loadDatasourceFailureAction, loadDatasourcePendingAction, queriesImportedAction, loadDatasourceSuccessAction, modifyQueriesAction, queryTransactionFailureAction, queryTransactionStartAction, queryTransactionSuccessAction, scanRangeAction, runQueriesEmptyAction, scanStartAction, setQueriesAction, splitCloseAction, splitOpenAction, addQueryRowAction, toggleGraphAction, toggleLogsAction, toggleTableAction, updateUIStateAction, } from './actionTypes';
/**
 * Updates UI state and save it to the URL
 */
var updateExploreUIState = function (exploreId, uiStateFragment) {
    return function (dispatch) {
        dispatch(updateUIStateAction(tslib_1.__assign({ exploreId: exploreId }, uiStateFragment)));
        dispatch(stateSave());
    };
};
/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId, index) {
    var query = generateEmptyQuery(index + 1);
    return addQueryRowAction({ exploreId: exploreId, index: index, query: query });
}
/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId, datasource) {
    var _this = this;
    return function (dispatch, getState) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var newDataSourceInstance, currentDataSourceInstance, queries, error_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDatasourceSrv().get(datasource)];
                case 1:
                    newDataSourceInstance = _a.sent();
                    currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
                    queries = getState().explore[exploreId].queries;
                    return [4 /*yield*/, dispatch(importQueries(exploreId, queries, currentDataSourceInstance, newDataSourceInstance))];
                case 2:
                    _a.sent();
                    dispatch(updateDatasourceInstanceAction({ exploreId: exploreId, datasourceInstance: newDataSourceInstance }));
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, dispatch(loadDatasource(exploreId, newDataSourceInstance))];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error(error_1);
                    return [2 /*return*/];
                case 6:
                    dispatch(runQueries(exploreId));
                    return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export function changeQuery(exploreId, query, index, override) {
    return function (dispatch) {
        // Null query means reset
        if (query === null) {
            query = tslib_1.__assign({}, generateEmptyQuery(index));
        }
        dispatch(changeQueryAction({ exploreId: exploreId, query: query, index: index, override: override }));
        if (override) {
            dispatch(runQueries(exploreId));
        }
    };
}
/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(exploreId, _a) {
    var height = _a.height, width = _a.width;
    return changeSizeAction({ exploreId: exploreId, height: height, width: width });
}
/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export function changeTime(exploreId, range) {
    return function (dispatch) {
        dispatch(changeTimeAction({ exploreId: exploreId, range: range }));
        dispatch(runQueries(exploreId));
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
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export function initializeExplore(exploreId, datasourceName, queries, range, containerWidth, eventBridge, ui) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var exploreDatasources, instance, error_2, error_3;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    exploreDatasources = getDatasourceSrv()
                        .getExternal()
                        .map(function (ds) { return ({
                        value: ds.name,
                        name: ds.name,
                        meta: ds.meta,
                    }); });
                    dispatch(initializeExploreAction({
                        exploreId: exploreId,
                        containerWidth: containerWidth,
                        eventBridge: eventBridge,
                        exploreDatasources: exploreDatasources,
                        queries: queries,
                        range: range,
                        ui: ui,
                    }));
                    if (!(exploreDatasources.length >= 1)) return [3 /*break*/, 11];
                    instance = void 0;
                    if (!datasourceName) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getDatasourceSrv().get(datasourceName)];
                case 2:
                    instance = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error(error_2);
                    return [3 /*break*/, 4];
                case 4:
                    if (!!instance) return [3 /*break*/, 6];
                    return [4 /*yield*/, getDatasourceSrv().get()];
                case 5:
                    instance = _a.sent();
                    _a.label = 6;
                case 6:
                    dispatch(updateDatasourceInstanceAction({ exploreId: exploreId, datasourceInstance: instance }));
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, dispatch(loadDatasource(exploreId, instance))];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 9:
                    error_3 = _a.sent();
                    console.error(error_3);
                    return [2 /*return*/];
                case 10:
                    dispatch(runQueries(exploreId, true));
                    return [3 /*break*/, 12];
                case 11:
                    dispatch(loadDatasourceMissingAction({ exploreId: exploreId }));
                    _a.label = 12;
                case 12: return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Datasource loading was successfully completed. The instance is stored in the state as well in case we need to
 * run datasource-specific code. Existing queries are imported to the new datasource if an importer exists,
 * e.g., Prometheus -> Loki queries.
 */
export var loadDatasourceSuccess = function (exploreId, instance) {
    // Capabilities
    var supportsGraph = instance.meta.metrics;
    var supportsLogs = instance.meta.logs;
    var supportsTable = instance.meta.tables;
    // Custom components
    var StartPage = instance.pluginExports.ExploreStartPage;
    var historyKey = "grafana.explore.history." + instance.meta.id;
    var history = store.getObject(historyKey, []);
    // Save last-used datasource
    store.set(LAST_USED_DATASOURCE_KEY, instance.name);
    return loadDatasourceSuccessAction({
        exploreId: exploreId,
        StartPage: StartPage,
        datasourceInstance: instance,
        history: history,
        showingStartPage: Boolean(StartPage),
        supportsGraph: supportsGraph,
        supportsLogs: supportsLogs,
        supportsTable: supportsTable,
    });
};
export function importQueries(exploreId, queries, sourceDataSource, targetDataSource) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var importedQueries, nextQueries;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    importedQueries = queries;
                    if (!(sourceDataSource.meta.id === targetDataSource.meta.id)) return [3 /*break*/, 1];
                    // Keep same queries if same type of datasource
                    importedQueries = tslib_1.__spread(queries);
                    return [3 /*break*/, 4];
                case 1:
                    if (!targetDataSource.importQueries) return [3 /*break*/, 3];
                    return [4 /*yield*/, targetDataSource.importQueries(queries, sourceDataSource.meta)];
                case 2:
                    // Datasource-specific importers
                    importedQueries = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    // Default is blank queries
                    importedQueries = ensureQueries();
                    _a.label = 4;
                case 4:
                    nextQueries = importedQueries.map(function (q, i) { return (tslib_1.__assign({}, q, generateEmptyQuery(i))); });
                    dispatch(queriesImportedAction({ exploreId: exploreId, queries: nextQueries }));
                    return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export function loadDatasource(exploreId, instance) {
    var _this = this;
    return function (dispatch, getState) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var datasourceName, datasourceError, testResult, error_4;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    datasourceName = instance.name;
                    // Keep ID to track selection
                    dispatch(loadDatasourcePendingAction({ exploreId: exploreId, requestedDatasourceName: datasourceName }));
                    datasourceError = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, instance.testDatasource()];
                case 2:
                    testResult = _a.sent();
                    datasourceError = testResult.status === 'success' ? null : testResult.message;
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    datasourceError = (error_4 && error_4.statusText) || 'Network error';
                    return [3 /*break*/, 4];
                case 4:
                    if (datasourceError) {
                        dispatch(loadDatasourceFailureAction({ exploreId: exploreId, error: datasourceError }));
                        return [2 /*return*/, Promise.reject(datasourceName + " loading failed")];
                    }
                    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
                        // User already changed datasource again, discard results
                        return [2 /*return*/];
                    }
                    if (instance.init) {
                        instance.init();
                    }
                    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
                        // User already changed datasource again, discard results
                        return [2 /*return*/];
                    }
                    dispatch(loadDatasourceSuccess(exploreId, instance));
                    return [2 /*return*/, Promise.resolve()];
            }
        });
    }); };
}
/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(exploreId, modification, index, modifier) {
    return function (dispatch) {
        dispatch(modifyQueriesAction({ exploreId: exploreId, modification: modification, index: index, modifier: modifier }));
        if (!modification.preventSubmit) {
            dispatch(runQueries(exploreId));
        }
    };
}
/**
 * Mark a query transaction as failed with an error extracted from the query response.
 * The transaction will be marked as `done`.
 */
export function queryTransactionFailure(exploreId, transactionId, response, datasourceId) {
    return function (dispatch, getState) {
        var _a = getState().explore[exploreId], datasourceInstance = _a.datasourceInstance, queryTransactions = _a.queryTransactions;
        if (datasourceInstance.meta.id !== datasourceId || response.cancelled) {
            // Navigated away, queries did not matter
            return;
        }
        // Transaction might have been discarded
        if (!queryTransactions.find(function (qt) { return qt.id === transactionId; })) {
            return;
        }
        console.error(response);
        var error;
        var errorDetails;
        if (response.data) {
            if (typeof response.data === 'string') {
                error = response.data;
            }
            else if (response.data.error) {
                error = response.data.error;
                if (response.data.response) {
                    errorDetails = response.data.response;
                }
            }
            else {
                throw new Error('Could not handle error response');
            }
        }
        else if (response.message) {
            error = response.message;
        }
        else if (typeof response === 'string') {
            error = response;
        }
        else {
            error = 'Unknown error during query transaction. Please check JS console logs.';
        }
        // Mark transactions as complete
        var nextQueryTransactions = queryTransactions.map(function (qt) {
            if (qt.id === transactionId) {
                return tslib_1.__assign({}, qt, { error: error,
                    errorDetails: errorDetails, done: true });
            }
            return qt;
        });
        dispatch(queryTransactionFailureAction({ exploreId: exploreId, queryTransactions: nextQueryTransactions }));
    };
}
/**
 * Complete a query transaction, mark the transaction as `done` and store query state in URL.
 * If the transaction was started by a scanner, it keeps on scanning for more results.
 * Side-effect: the query is stored in localStorage.
 * @param exploreId Explore area
 * @param transactionId ID
 * @param result Response from `datasourceInstance.query()`
 * @param latency Duration between request and response
 * @param queries Queries from all query rows
 * @param datasourceId Origin datasource instance, used to discard results if current datasource is different
 */
export function queryTransactionSuccess(exploreId, transactionId, result, latency, queries, datasourceId) {
    return function (dispatch, getState) {
        var _a = getState().explore[exploreId], datasourceInstance = _a.datasourceInstance, history = _a.history, queryTransactions = _a.queryTransactions, scanner = _a.scanner, scanning = _a.scanning;
        // If datasource already changed, results do not matter
        if (datasourceInstance.meta.id !== datasourceId) {
            return;
        }
        // Transaction might have been discarded
        var transaction = queryTransactions.find(function (qt) { return qt.id === transactionId; });
        if (!transaction) {
            return;
        }
        // Get query hints
        var hints;
        if (datasourceInstance.getQueryHints) {
            hints = datasourceInstance.getQueryHints(transaction.query, result);
        }
        // Mark transactions as complete and attach result
        var nextQueryTransactions = queryTransactions.map(function (qt) {
            if (qt.id === transactionId) {
                return tslib_1.__assign({}, qt, { hints: hints,
                    latency: latency,
                    result: result, done: true });
            }
            return qt;
        });
        // Side-effect: Saving history in localstorage
        var nextHistory = updateHistory(history, datasourceId, queries);
        dispatch(queryTransactionSuccessAction({
            exploreId: exploreId,
            history: nextHistory,
            queryTransactions: nextQueryTransactions,
        }));
        // Keep scanning for results if this was the last scanning transaction
        if (scanning) {
            if (_.size(result) === 0) {
                var other = nextQueryTransactions.find(function (qt) { return qt.scanning && !qt.done; });
                if (!other) {
                    var range = scanner();
                    dispatch(scanRangeAction({ exploreId: exploreId, range: range }));
                }
            }
            else {
                // We can stop scanning if we have a result
                dispatch(scanStopAction({ exploreId: exploreId }));
            }
        }
    };
}
/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export function runQueries(exploreId, ignoreUIState) {
    if (ignoreUIState === void 0) { ignoreUIState = false; }
    return function (dispatch, getState) {
        var _a = getState().explore[exploreId], datasourceInstance = _a.datasourceInstance, queries = _a.queries, showingLogs = _a.showingLogs, showingGraph = _a.showingGraph, showingTable = _a.showingTable, supportsGraph = _a.supportsGraph, supportsLogs = _a.supportsLogs, supportsTable = _a.supportsTable;
        if (!hasNonEmptyQuery(queries)) {
            dispatch(runQueriesEmptyAction({ exploreId: exploreId }));
            dispatch(stateSave()); // Remember to saves to state and update location
            return;
        }
        // Some datasource's query builders allow per-query interval limits,
        // but we're using the datasource interval limit for now
        var interval = datasourceInstance.interval;
        // Keep table queries first since they need to return quickly
        if ((ignoreUIState || showingTable) && supportsTable) {
            dispatch(runQueriesForType(exploreId, 'Table', {
                interval: interval,
                format: 'table',
                instant: true,
                valueWithRefId: true,
            }, function (data) { return data[0]; }));
        }
        if ((ignoreUIState || showingGraph) && supportsGraph) {
            dispatch(runQueriesForType(exploreId, 'Graph', {
                interval: interval,
                format: 'time_series',
                instant: false,
            }, makeTimeSeriesList));
        }
        if ((ignoreUIState || showingLogs) && supportsLogs) {
            dispatch(runQueriesForType(exploreId, 'Logs', { interval: interval, format: 'logs' }));
        }
        dispatch(stateSave());
    };
}
/**
 * Helper action to build a query transaction object and handing the query to the datasource.
 * @param exploreId Explore area
 * @param resultType Result viewer that will be associated with this query result
 * @param queryOptions Query options as required by the datasource's `query()` function.
 * @param resultGetter Optional result extractor, e.g., if the result is a list and you only need the first element.
 */
function runQueriesForType(exploreId, resultType, queryOptions, resultGetter) {
    var _this = this;
    return function (dispatch, getState) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var _a, datasourceInstance, eventBridge, queries, queryIntervals, range, scanning, datasourceId;
        var _this = this;
        return tslib_1.__generator(this, function (_b) {
            _a = getState().explore[exploreId], datasourceInstance = _a.datasourceInstance, eventBridge = _a.eventBridge, queries = _a.queries, queryIntervals = _a.queryIntervals, range = _a.range, scanning = _a.scanning;
            datasourceId = datasourceInstance.meta.id;
            // Run all queries concurrently
            queries.forEach(function (query, rowIndex) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var transaction, now, res, latency, queryTransactions, results, response_1;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            transaction = buildQueryTransaction(query, rowIndex, resultType, queryOptions, range, queryIntervals, scanning);
                            dispatch(queryTransactionStartAction({ exploreId: exploreId, resultType: resultType, rowIndex: rowIndex, transaction: transaction }));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            now = Date.now();
                            return [4 /*yield*/, datasourceInstance.query(transaction.options)];
                        case 2:
                            res = _a.sent();
                            eventBridge.emit('data-received', res.data || []);
                            latency = Date.now() - now;
                            queryTransactions = getState().explore[exploreId].queryTransactions;
                            results = resultGetter ? resultGetter(res.data, transaction, queryTransactions) : res.data;
                            dispatch(queryTransactionSuccess(exploreId, transaction.id, results, latency, queries, datasourceId));
                            return [3 /*break*/, 4];
                        case 3:
                            response_1 = _a.sent();
                            eventBridge.emit('data-error', response_1);
                            dispatch(queryTransactionFailure(exploreId, transaction.id, response_1, datasourceId));
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    }); };
}
/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId, scanner) {
    return function (dispatch) {
        // Register the scanner
        dispatch(scanStartAction({ exploreId: exploreId, scanner: scanner }));
        // Scanning must trigger query run, and return the new range
        var range = scanner();
        // Set the new range to be displayed
        dispatch(scanRangeAction({ exploreId: exploreId, range: range }));
    };
}
/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId, rawQueries) {
    return function (dispatch) {
        // Inject react keys into query objects
        var queries = rawQueries.map(function (q) { return (tslib_1.__assign({}, q, generateEmptyQuery())); });
        dispatch(setQueriesAction({ exploreId: exploreId, queries: queries }));
        dispatch(runQueries(exploreId));
    };
}
/**
 * Close the split view and save URL state.
 */
export function splitClose() {
    return function (dispatch) {
        dispatch(splitCloseAction());
        dispatch(stateSave());
    };
}
/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export function splitOpen() {
    return function (dispatch, getState) {
        // Clone left state to become the right state
        var leftState = getState().explore.left;
        var itemState = tslib_1.__assign({}, leftState, { queryTransactions: [], queries: leftState.queries.slice() });
        dispatch(splitOpenAction({ itemState: itemState }));
        dispatch(stateSave());
    };
}
/**
 * Saves Explore state to URL using the `left` and `right` parameters.
 * If split view is not active, `right` will not be set.
 */
export function stateSave() {
    return function (dispatch, getState) {
        var _a = getState().explore, left = _a.left, right = _a.right, split = _a.split;
        var urlStates = {};
        var leftUrlState = {
            datasource: left.datasourceInstance.name,
            queries: left.queries.map(clearQueryKeys),
            range: left.range,
            ui: {
                showingGraph: left.showingGraph,
                showingLogs: left.showingLogs,
                showingTable: left.showingTable,
                dedupStrategy: left.dedupStrategy,
            },
        };
        urlStates.left = serializeStateToUrlParam(leftUrlState, true);
        if (split) {
            var rightUrlState = {
                datasource: right.datasourceInstance.name,
                queries: right.queries.map(clearQueryKeys),
                range: right.range,
                ui: {
                    showingGraph: right.showingGraph,
                    showingLogs: right.showingLogs,
                    showingTable: right.showingTable,
                    dedupStrategy: right.dedupStrategy,
                },
            };
            urlStates.right = serializeStateToUrlParam(rightUrlState, true);
        }
        dispatch(updateLocation({ query: urlStates }));
    };
}
/**
 * Creates action to collapse graph/logs/table panel. When panel is collapsed,
 * queries won't be run
 */
var togglePanelActionCreator = function (actionCreator) { return function (exploreId, isPanelVisible) {
    return function (dispatch) {
        var uiFragmentStateUpdate;
        var shouldRunQueries = !isPanelVisible;
        switch (actionCreator.type) {
            case toggleGraphAction.type:
                uiFragmentStateUpdate = { showingGraph: !isPanelVisible };
                break;
            case toggleLogsAction.type:
                uiFragmentStateUpdate = { showingLogs: !isPanelVisible };
                break;
            case toggleTableAction.type:
                uiFragmentStateUpdate = { showingTable: !isPanelVisible };
                break;
        }
        dispatch(actionCreator({ exploreId: exploreId }));
        dispatch(updateExploreUIState(exploreId, uiFragmentStateUpdate));
        if (shouldRunQueries) {
            dispatch(runQueries(exploreId));
        }
    };
}; };
/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export var toggleGraph = togglePanelActionCreator(toggleGraphAction);
/**
 * Expand/collapse the logs result viewer. When collapsed, log queries won't be run.
 */
export var toggleLogs = togglePanelActionCreator(toggleLogsAction);
/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export var toggleTable = togglePanelActionCreator(toggleTableAction);
/**
 * Change logs deduplication strategy and update URL.
 */
export var changeDedupStrategy = function (exploreId, dedupStrategy) {
    return function (dispatch) {
        dispatch(updateExploreUIState(exploreId, { dedupStrategy: dedupStrategy }));
    };
};
//# sourceMappingURL=actions.js.map