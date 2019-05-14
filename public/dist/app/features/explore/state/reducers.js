import * as tslib_1 from "tslib";
import { calculateResultsFromQueryTransactions, generateEmptyQuery, getIntervals, ensureQueries, getQueryKeys, } from 'app/core/utils/explore';
import { ActionTypes } from './actionTypes';
import { reducerFactory } from 'app/core/redux';
import { addQueryRowAction, changeQueryAction, changeSizeAction, changeTimeAction, clearQueriesAction, highlightLogsExpressionAction, initializeExploreAction, updateDatasourceInstanceAction, loadDatasourceFailureAction, loadDatasourceMissingAction, loadDatasourcePendingAction, loadDatasourceSuccessAction, modifyQueriesAction, queryTransactionFailureAction, queryTransactionStartAction, queryTransactionSuccessAction, removeQueryRowAction, runQueriesEmptyAction, scanRangeAction, scanStartAction, scanStopAction, setQueriesAction, toggleGraphAction, toggleLogsAction, toggleTableAction, queriesImportedAction, updateUIStateAction, toggleLogLevelAction, } from './actionTypes';
export var DEFAULT_RANGE = {
    from: 'now-6h',
    to: 'now',
};
// Millies step for helper bar charts
var DEFAULT_GRAPH_INTERVAL = 15 * 1000;
/**
 * Returns a fresh Explore area state
 */
export var makeExploreItemState = function () { return ({
    StartPage: undefined,
    containerWidth: 0,
    datasourceInstance: null,
    requestedDatasourceName: null,
    datasourceError: null,
    datasourceLoading: null,
    datasourceMissing: false,
    exploreDatasources: [],
    history: [],
    queries: [],
    initialized: false,
    queryTransactions: [],
    queryIntervals: { interval: '15s', intervalMs: DEFAULT_GRAPH_INTERVAL },
    range: DEFAULT_RANGE,
    scanning: false,
    scanRange: null,
    showingGraph: true,
    showingLogs: true,
    showingTable: true,
    supportsGraph: null,
    supportsLogs: null,
    supportsTable: null,
    queryKeys: [],
}); };
/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
export var initialExploreState = {
    split: null,
    left: makeExploreItemState(),
    right: makeExploreItemState(),
};
/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
export var itemReducer = reducerFactory({})
    .addMapper({
    filter: addQueryRowAction,
    mapper: function (state, action) {
        var queries = state.queries, queryTransactions = state.queryTransactions;
        var _a = action.payload, index = _a.index, query = _a.query;
        // Add to queries, which will cause a new row to be rendered
        var nextQueries = tslib_1.__spread(queries.slice(0, index + 1), [tslib_1.__assign({}, query)], queries.slice(index + 1));
        // Ongoing transactions need to update their row indices
        var nextQueryTransactions = queryTransactions.map(function (qt) {
            if (qt.rowIndex > index) {
                return tslib_1.__assign({}, qt, { rowIndex: qt.rowIndex + 1 });
            }
            return qt;
        });
        return tslib_1.__assign({}, state, { queries: nextQueries, logsHighlighterExpressions: undefined, queryTransactions: nextQueryTransactions, queryKeys: getQueryKeys(nextQueries, state.datasourceInstance) });
    },
})
    .addMapper({
    filter: changeQueryAction,
    mapper: function (state, action) {
        var queries = state.queries, queryTransactions = state.queryTransactions;
        var _a = action.payload, query = _a.query, index = _a.index;
        // Override path: queries are completely reset
        var nextQuery = tslib_1.__assign({}, query, generateEmptyQuery(index));
        var nextQueries = tslib_1.__spread(queries);
        nextQueries[index] = nextQuery;
        // Discard ongoing transaction related to row query
        var nextQueryTransactions = queryTransactions.filter(function (qt) { return qt.rowIndex !== index; });
        return tslib_1.__assign({}, state, { queries: nextQueries, queryTransactions: nextQueryTransactions, queryKeys: getQueryKeys(nextQueries, state.datasourceInstance) });
    },
})
    .addMapper({
    filter: changeSizeAction,
    mapper: function (state, action) {
        var range = state.range, datasourceInstance = state.datasourceInstance;
        var interval = '1s';
        if (datasourceInstance && datasourceInstance.interval) {
            interval = datasourceInstance.interval;
        }
        var containerWidth = action.payload.width;
        var queryIntervals = getIntervals(range, interval, containerWidth);
        return tslib_1.__assign({}, state, { containerWidth: containerWidth, queryIntervals: queryIntervals });
    },
})
    .addMapper({
    filter: changeTimeAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { range: action.payload.range });
    },
})
    .addMapper({
    filter: clearQueriesAction,
    mapper: function (state) {
        var queries = ensureQueries();
        return tslib_1.__assign({}, state, { queries: queries.slice(), queryTransactions: [], showingStartPage: Boolean(state.StartPage), queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    },
})
    .addMapper({
    filter: highlightLogsExpressionAction,
    mapper: function (state, action) {
        var expressions = action.payload.expressions;
        return tslib_1.__assign({}, state, { logsHighlighterExpressions: expressions });
    },
})
    .addMapper({
    filter: initializeExploreAction,
    mapper: function (state, action) {
        var _a = action.payload, containerWidth = _a.containerWidth, eventBridge = _a.eventBridge, exploreDatasources = _a.exploreDatasources, queries = _a.queries, range = _a.range, ui = _a.ui;
        return tslib_1.__assign({}, state, { containerWidth: containerWidth,
            eventBridge: eventBridge,
            exploreDatasources: exploreDatasources,
            range: range,
            queries: queries, initialized: true, queryKeys: getQueryKeys(queries, state.datasourceInstance) }, ui);
    },
})
    .addMapper({
    filter: updateDatasourceInstanceAction,
    mapper: function (state, action) {
        var datasourceInstance = action.payload.datasourceInstance;
        return tslib_1.__assign({}, state, { datasourceInstance: datasourceInstance, queryKeys: getQueryKeys(state.queries, datasourceInstance) });
    },
})
    .addMapper({
    filter: loadDatasourceFailureAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { datasourceError: action.payload.error, datasourceLoading: false });
    },
})
    .addMapper({
    filter: loadDatasourceMissingAction,
    mapper: function (state) {
        return tslib_1.__assign({}, state, { datasourceMissing: true, datasourceLoading: false });
    },
})
    .addMapper({
    filter: loadDatasourcePendingAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { datasourceLoading: true, requestedDatasourceName: action.payload.requestedDatasourceName });
    },
})
    .addMapper({
    filter: loadDatasourceSuccessAction,
    mapper: function (state, action) {
        var containerWidth = state.containerWidth, range = state.range;
        var _a = action.payload, StartPage = _a.StartPage, datasourceInstance = _a.datasourceInstance, history = _a.history, showingStartPage = _a.showingStartPage, supportsGraph = _a.supportsGraph, supportsLogs = _a.supportsLogs, supportsTable = _a.supportsTable;
        var queryIntervals = getIntervals(range, datasourceInstance.interval, containerWidth);
        return tslib_1.__assign({}, state, { queryIntervals: queryIntervals,
            StartPage: StartPage,
            datasourceInstance: datasourceInstance,
            history: history,
            showingStartPage: showingStartPage,
            supportsGraph: supportsGraph,
            supportsLogs: supportsLogs,
            supportsTable: supportsTable, datasourceLoading: false, datasourceMissing: false, datasourceError: null, logsHighlighterExpressions: undefined, queryTransactions: [] });
    },
})
    .addMapper({
    filter: modifyQueriesAction,
    mapper: function (state, action) {
        var queries = state.queries, queryTransactions = state.queryTransactions;
        var _a = action.payload, modification = _a.modification, index = _a.index, modifier = _a.modifier;
        var nextQueries;
        var nextQueryTransactions;
        if (index === undefined) {
            // Modify all queries
            nextQueries = queries.map(function (query, i) { return (tslib_1.__assign({}, modifier(tslib_1.__assign({}, query), modification), generateEmptyQuery(i))); });
            // Discard all ongoing transactions
            nextQueryTransactions = [];
        }
        else {
            // Modify query only at index
            nextQueries = queries.map(function (query, i) {
                // Synchronize all queries with local query cache to ensure consistency
                // TODO still needed?
                return i === index ? tslib_1.__assign({}, modifier(tslib_1.__assign({}, query), modification), generateEmptyQuery(i)) : query;
            });
            nextQueryTransactions = queryTransactions
                // Consume the hint corresponding to the action
                .map(function (qt) {
                if (qt.hints != null && qt.rowIndex === index) {
                    qt.hints = qt.hints.filter(function (hint) { return hint.fix.action !== modification; });
                }
                return qt;
            })
                // Preserve previous row query transaction to keep results visible if next query is incomplete
                .filter(function (qt) { return modification.preventSubmit || qt.rowIndex !== index; });
        }
        return tslib_1.__assign({}, state, { queries: nextQueries, queryKeys: getQueryKeys(nextQueries, state.datasourceInstance), queryTransactions: nextQueryTransactions });
    },
})
    .addMapper({
    filter: queryTransactionFailureAction,
    mapper: function (state, action) {
        var queryTransactions = action.payload.queryTransactions;
        return tslib_1.__assign({}, state, { queryTransactions: queryTransactions, showingStartPage: false });
    },
})
    .addMapper({
    filter: queryTransactionStartAction,
    mapper: function (state, action) {
        var queryTransactions = state.queryTransactions;
        var _a = action.payload, resultType = _a.resultType, rowIndex = _a.rowIndex, transaction = _a.transaction;
        // Discarding existing transactions of same type
        var remainingTransactions = queryTransactions.filter(function (qt) { return !(qt.resultType === resultType && qt.rowIndex === rowIndex); });
        // Append new transaction
        var nextQueryTransactions = tslib_1.__spread(remainingTransactions, [transaction]);
        return tslib_1.__assign({}, state, { queryTransactions: nextQueryTransactions, showingStartPage: false });
    },
})
    .addMapper({
    filter: queryTransactionSuccessAction,
    mapper: function (state, action) {
        var datasourceInstance = state.datasourceInstance, queryIntervals = state.queryIntervals;
        var _a = action.payload, history = _a.history, queryTransactions = _a.queryTransactions;
        var results = calculateResultsFromQueryTransactions(queryTransactions, datasourceInstance, queryIntervals.intervalMs);
        return tslib_1.__assign({}, state, results, { history: history, queryTransactions: queryTransactions, showingStartPage: false });
    },
})
    .addMapper({
    filter: removeQueryRowAction,
    mapper: function (state, action) {
        var datasourceInstance = state.datasourceInstance, queries = state.queries, queryIntervals = state.queryIntervals, queryTransactions = state.queryTransactions, queryKeys = state.queryKeys;
        var index = action.payload.index;
        if (queries.length <= 1) {
            return state;
        }
        var nextQueries = tslib_1.__spread(queries.slice(0, index), queries.slice(index + 1));
        var nextQueryKeys = tslib_1.__spread(queryKeys.slice(0, index), queryKeys.slice(index + 1));
        // Discard transactions related to row query
        var nextQueryTransactions = queryTransactions.filter(function (qt) { return nextQueries.some(function (nq) { return nq.key === qt.query.key; }); });
        var results = calculateResultsFromQueryTransactions(nextQueryTransactions, datasourceInstance, queryIntervals.intervalMs);
        return tslib_1.__assign({}, state, results, { queries: nextQueries, logsHighlighterExpressions: undefined, queryTransactions: nextQueryTransactions, queryKeys: nextQueryKeys });
    },
})
    .addMapper({
    filter: runQueriesEmptyAction,
    mapper: function (state) {
        return tslib_1.__assign({}, state, { queryTransactions: [] });
    },
})
    .addMapper({
    filter: scanRangeAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { scanRange: action.payload.range });
    },
})
    .addMapper({
    filter: scanStartAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { scanning: true, scanner: action.payload.scanner });
    },
})
    .addMapper({
    filter: scanStopAction,
    mapper: function (state) {
        var queryTransactions = state.queryTransactions;
        var nextQueryTransactions = queryTransactions.filter(function (qt) { return qt.scanning && !qt.done; });
        return tslib_1.__assign({}, state, { queryTransactions: nextQueryTransactions, scanning: false, scanRange: undefined, scanner: undefined });
    },
})
    .addMapper({
    filter: setQueriesAction,
    mapper: function (state, action) {
        var queries = action.payload.queries;
        return tslib_1.__assign({}, state, { queries: queries.slice(), queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    },
})
    .addMapper({
    filter: updateUIStateAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, action.payload);
    },
})
    .addMapper({
    filter: toggleGraphAction,
    mapper: function (state) {
        var showingGraph = !state.showingGraph;
        var nextQueryTransactions = state.queryTransactions;
        if (!showingGraph) {
            // Discard transactions related to Graph query
            nextQueryTransactions = state.queryTransactions.filter(function (qt) { return qt.resultType !== 'Graph'; });
        }
        return tslib_1.__assign({}, state, { queryTransactions: nextQueryTransactions });
    },
})
    .addMapper({
    filter: toggleLogsAction,
    mapper: function (state) {
        var showingLogs = !state.showingLogs;
        var nextQueryTransactions = state.queryTransactions;
        if (!showingLogs) {
            // Discard transactions related to Logs query
            nextQueryTransactions = state.queryTransactions.filter(function (qt) { return qt.resultType !== 'Logs'; });
        }
        return tslib_1.__assign({}, state, { queryTransactions: nextQueryTransactions });
    },
})
    .addMapper({
    filter: toggleTableAction,
    mapper: function (state) {
        var showingTable = !state.showingTable;
        if (showingTable) {
            return tslib_1.__assign({}, state, { queryTransactions: state.queryTransactions });
        }
        // Toggle off needs discarding of table queries and results
        var nextQueryTransactions = state.queryTransactions.filter(function (qt) { return qt.resultType !== 'Table'; });
        var results = calculateResultsFromQueryTransactions(nextQueryTransactions, state.datasourceInstance, state.queryIntervals.intervalMs);
        return tslib_1.__assign({}, state, results, { queryTransactions: nextQueryTransactions });
    },
})
    .addMapper({
    filter: queriesImportedAction,
    mapper: function (state, action) {
        var queries = action.payload.queries;
        return tslib_1.__assign({}, state, { queries: queries, queryKeys: getQueryKeys(queries, state.datasourceInstance) });
    },
})
    .addMapper({
    filter: toggleLogLevelAction,
    mapper: function (state, action) {
        var hiddenLogLevels = action.payload.hiddenLogLevels;
        return tslib_1.__assign({}, state, { hiddenLogLevels: Array.from(hiddenLogLevels) });
    },
})
    .create();
/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export var exploreReducer = function (state, action) {
    if (state === void 0) { state = initialExploreState; }
    var _a;
    switch (action.type) {
        case ActionTypes.SplitClose: {
            return tslib_1.__assign({}, state, { split: false });
        }
        case ActionTypes.SplitOpen: {
            return tslib_1.__assign({}, state, { split: true, right: action.payload.itemState });
        }
        case ActionTypes.InitializeExploreSplit: {
            return tslib_1.__assign({}, state, { split: true });
        }
        case ActionTypes.ResetExplore: {
            return initialExploreState;
        }
    }
    if (action.payload) {
        var exploreId = action.payload.exploreId;
        if (exploreId !== undefined) {
            var exploreItemState = state[exploreId];
            return tslib_1.__assign({}, state, (_a = {}, _a[exploreId] = itemReducer(exploreItemState, action), _a));
        }
    }
    return state;
};
export default {
    explore: exploreReducer,
};
//# sourceMappingURL=reducers.js.map