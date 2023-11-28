import { __awaiter } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import deepEqual from 'fast-deep-equal';
import { findLast, flatten, groupBy, head, map, mapValues, snakeCase, zipObject } from 'lodash';
import { combineLatest, identity, of } from 'rxjs';
import { mergeMap, throttleTime } from 'rxjs/operators';
import { DataQueryErrorType, hasQueryExportSupport, hasQueryImportSupport, LoadingState, LogsVolumeType, PanelEvents, toLegacyResponseData, } from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { buildQueryTransaction, ensureQueries, generateEmptyQuery, generateNewKeyAndAddRefIdIfMissing, getQueryKeys, hasNonEmptyQuery, stopQueryState, updateHistory, } from 'app/core/utils/explore';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { createAsyncThunk, } from 'app/types';
import { notifyApp } from '../../../core/actions';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { runRequest } from '../../query/state/runRequest';
import { decorateData } from '../utils/decorators';
import { getSupplementaryQueryProvider, storeSupplementaryQueryEnabled, supplementaryQueryTypes, } from '../utils/supplementaryQueries';
import { getCorrelations } from './correlations';
import { saveCorrelationsAction } from './explorePane';
import { addHistoryItem, historyUpdatedAction, loadRichHistory } from './history';
import { changeCorrelationEditorDetails } from './main';
import { updateTime } from './time';
import { createCacheKey, filterLogRowsByIndex, getDatasourceUIDs, getResultsFromCache } from './utils';
/**
 * Derives from explore state if a given Explore pane is waiting for more data to be received
 */
export const selectIsWaitingForData = (exploreId) => {
    return (state) => {
        const panelState = state.explore.panes[exploreId];
        if (!panelState) {
            return false;
        }
        return panelState.queryResponse
            ? panelState.queryResponse.state === LoadingState.Loading ||
                panelState.queryResponse.state === LoadingState.Streaming
            : false;
    };
};
export const addQueryRowAction = createAction('explore/addQueryRow');
export const changeQueriesAction = createAction('explore/changeQueries');
export const cancelQueriesAction = createAction('explore/cancelQueries');
export const queriesImportedAction = createAction('explore/queriesImported');
export const queryStoreSubscriptionAction = createAction('explore/queryStoreSubscription');
const setSupplementaryQueryEnabledAction = createAction('explore/setSupplementaryQueryEnabledAction');
/**
 * Stores available supplementary query data provider after running the query. Used internally by runQueries().
 */
export const storeSupplementaryQueryDataProviderAction = createAction('explore/storeSupplementaryQueryDataProviderAction');
export const cleanSupplementaryQueryDataProviderAction = createAction('explore/cleanSupplementaryQueryDataProviderAction');
export const cleanSupplementaryQueryAction = createAction('explore/cleanSupplementaryQueryAction');
/**
 * Stores current logs volume subscription for given explore pane.
 */
const storeSupplementaryQueryDataSubscriptionAction = createAction('explore/storeSupplementaryQueryDataSubscriptionAction');
/**
 * Stores data returned by the provider. Used internally by loadSupplementaryQueryData().
 */
const updateSupplementaryQueryDataAction = createAction('explore/updateSupplementaryQueryDataAction');
export const queryStreamUpdatedAction = createAction('explore/queryStreamUpdated');
export const setQueriesAction = createAction('explore/setQueries');
export const changeLoadingStateAction = createAction('changeLoadingState');
export const setPausedStateAction = createAction('explore/setPausedState');
export const clearLogs = createAction('explore/clearLogs');
export const scanStartAction = createAction('explore/scanStart');
export const scanStopAction = createAction('explore/scanStop');
export const addResultsToCacheAction = createAction('explore/addResultsToCache');
export const clearCacheAction = createAction('explore/clearCache');
/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId, index) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const pane = getState().explore.panes[exploreId];
        let datasourceOverride = undefined;
        // if we are not in mixed mode, use root datasource
        if (!((_a = pane.datasourceInstance) === null || _a === void 0 ? void 0 : _a.meta.mixed)) {
            datasourceOverride = (_b = pane.datasourceInstance) === null || _b === void 0 ? void 0 : _b.getRef();
        }
        else {
            // else try to get the datasource from the last query that defines one, falling back to the default datasource
            datasourceOverride = ((_c = findLast(pane.queries, (query) => !!query.datasource)) === null || _c === void 0 ? void 0 : _c.datasource) || undefined;
        }
        const query = yield generateEmptyQuery(pane.queries, index, datasourceOverride);
        dispatch(addQueryRowAction({ exploreId, index, query }));
    });
}
/**
 * Cancel running queries
 */
export function cancelQueries(exploreId) {
    return (dispatch, getState) => {
        var _a, _b;
        dispatch(scanStopAction({ exploreId }));
        dispatch(cancelQueriesAction({ exploreId }));
        const supplementaryQueries = getState().explore.panes[exploreId].supplementaryQueries;
        // Cancel all data providers
        for (const type of supplementaryQueryTypes) {
            dispatch(cleanSupplementaryQueryDataProviderAction({ exploreId, type }));
            // And clear any incomplete data
            if (((_b = (_a = supplementaryQueries[type]) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.state) !== LoadingState.Done) {
                dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
            }
        }
    };
}
const addDatasourceToQueries = (datasource, queries) => {
    const dataSourceRef = datasource.getRef();
    return queries.map((query) => {
        return Object.assign(Object.assign({}, query), { datasource: dataSourceRef });
    });
};
const getImportableQueries = (targetDataSource, sourceDataSource, queries) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let queriesOut = [];
    if (((_a = sourceDataSource.meta) === null || _a === void 0 ? void 0 : _a.id) === ((_b = targetDataSource.meta) === null || _b === void 0 ? void 0 : _b.id)) {
        queriesOut = queries;
    }
    else if (hasQueryExportSupport(sourceDataSource) && hasQueryImportSupport(targetDataSource)) {
        const abstractQueries = yield sourceDataSource.exportToAbstractQueries(queries);
        queriesOut = yield targetDataSource.importFromAbstractQueries(abstractQueries);
    }
    else if (targetDataSource.importQueries) {
        // Datasource-specific importers
        queriesOut = yield targetDataSource.importQueries(queries, sourceDataSource);
    }
    // add new datasource to queries before returning
    return addDatasourceToQueries(targetDataSource, queriesOut);
});
export const changeQueries = createAsyncThunk('explore/changeQueries', ({ queries, exploreId }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e, _f, _g, _h;
    let queriesImported = false;
    const oldQueries = getState().explore.panes[exploreId].queries;
    const rootUID = (_c = getState().explore.panes[exploreId].datasourceInstance) === null || _c === void 0 ? void 0 : _c.uid;
    const correlationDetails = getState().explore.correlationEditorDetails;
    const isCorrelationsEditorMode = (correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.editorMode) || false;
    const isLeftPane = Object.keys(getState().explore.panes)[0] === exploreId;
    if (!isLeftPane && isCorrelationsEditorMode && !(correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty)) {
        dispatch(changeCorrelationEditorDetails({ dirty: true }));
    }
    for (const newQuery of queries) {
        for (const oldQuery of oldQueries) {
            if (newQuery.refId === oldQuery.refId && ((_d = newQuery.datasource) === null || _d === void 0 ? void 0 : _d.type) !== ((_e = oldQuery.datasource) === null || _e === void 0 ? void 0 : _e.type)) {
                const queryDatasource = yield getDataSourceSrv().get(oldQuery.datasource);
                const targetDS = yield getDataSourceSrv().get({ uid: (_f = newQuery.datasource) === null || _f === void 0 ? void 0 : _f.uid });
                yield dispatch(importQueries(exploreId, oldQueries, queryDatasource, targetDS, newQuery.refId));
                queriesImported = true;
            }
            if (rootUID === MIXED_DATASOURCE_NAME &&
                newQuery.refId === oldQuery.refId &&
                ((_g = newQuery.datasource) === null || _g === void 0 ? void 0 : _g.uid) !== ((_h = oldQuery.datasource) === null || _h === void 0 ? void 0 : _h.uid)) {
                const datasourceUIDs = getDatasourceUIDs(MIXED_DATASOURCE_NAME, queries);
                const correlations = yield getCorrelationsBySourceUIDs(datasourceUIDs);
                dispatch(saveCorrelationsAction({ exploreId: exploreId, correlations: correlations.correlations || [] }));
            }
        }
    }
    // Importing queries changes the same state, therefore if we are importing queries we don't want to change the state again
    if (!queriesImported) {
        dispatch(changeQueriesAction({ queries, exploreId }));
    }
    // if we are removing a query we want to run the remaining ones
    if (queries.length < oldQueries.length) {
        dispatch(runQueries({ exploreId }));
    }
}));
/**
 * Import queries from previous datasource if possible eg Loki and Prometheus have similar query language so the
 * labels part can be reused to get similar data.
 * @param exploreId
 * @param queries
 * @param sourceDataSource
 * @param targetDataSource
 */
export const importQueries = (exploreId, queries, sourceDataSource, targetDataSource, singleQueryChangeRef // when changing one query DS to another in a mixed environment, we do not want to change all queries, just the one being changed
) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        if (!sourceDataSource) {
            // explore not initialized
            dispatch(queriesImportedAction({ exploreId, queries }));
            return;
        }
        let importedQueries = queries;
        // If going to mixed, keep queries with source datasource
        if (targetDataSource.uid === MIXED_DATASOURCE_NAME) {
            importedQueries = queries.map((query) => {
                return Object.assign(Object.assign({}, query), { datasource: sourceDataSource.getRef() });
            });
        }
        // If going from mixed, see what queries you keep by their individual datasources
        else if (sourceDataSource.uid === MIXED_DATASOURCE_NAME) {
            const groupedQueries = groupBy(queries, (query) => { var _a; return (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.uid; });
            const groupedImportableQueries = yield Promise.all(Object.keys(groupedQueries).map((key) => __awaiter(void 0, void 0, void 0, function* () {
                const queryDatasource = yield getDataSourceSrv().get({ uid: key });
                return yield getImportableQueries(targetDataSource, queryDatasource, groupedQueries[key]);
            })));
            importedQueries = flatten(groupedImportableQueries.filter((arr) => arr.length > 0));
        }
        else {
            let queriesStartArr = queries;
            if (singleQueryChangeRef !== undefined) {
                const changedQuery = queries.find((query) => query.refId === singleQueryChangeRef);
                if (changedQuery) {
                    queriesStartArr = [changedQuery];
                }
            }
            importedQueries = yield getImportableQueries(targetDataSource, sourceDataSource, queriesStartArr);
        }
        // this will be the entire imported set, or the single imported query in an array
        let nextQueries = yield ensureQueries(importedQueries, targetDataSource.getRef());
        if (singleQueryChangeRef !== undefined) {
            // if the query import didn't return a result, there was no ability to import between datasources. Create an empty query for the datasource
            if (importedQueries.length === 0) {
                const dsQuery = yield generateEmptyQuery([], undefined, targetDataSource.getRef());
                importedQueries = [dsQuery];
            }
            // capture the single imported query, and copy the original set
            const updatedQueryIdx = queries.findIndex((query) => query.refId === singleQueryChangeRef);
            // for single query change, all areas that generate refId do not know about other queries, so just copy the existing refID to the new query
            const changedQuery = Object.assign(Object.assign({}, nextQueries[0]), { refId: queries[updatedQueryIdx].refId });
            nextQueries = [...queries];
            // replace the changed query
            nextQueries[updatedQueryIdx] = changedQuery;
        }
        dispatch(queriesImportedAction({ exploreId, queries: nextQueries }));
        return nextQueries;
    });
};
/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(exploreId, modification, modifier) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        const state = getState().explore.panes[exploreId];
        const { queries } = state;
        const nextQueriesRaw = yield Promise.all(queries.map((query) => modifier(Object.assign({}, query), modification)));
        const nextQueries = nextQueriesRaw.map((nextQuery, i) => {
            return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries, i);
        });
        dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
        if (!modification.preventSubmit) {
            dispatch(runQueries({ exploreId }));
        }
    });
}
function handleHistory(dispatch, state, history, datasource, queries, exploreId) {
    return __awaiter(this, void 0, void 0, function* () {
        const datasourceId = datasource.meta.id;
        const nextHistory = updateHistory(history, datasourceId, queries);
        dispatch(historyUpdatedAction({ exploreId, history: nextHistory }));
        dispatch(addHistoryItem(datasource.uid, datasource.name, queries));
        // Because filtering happens in the backend we cannot add a new entry without checking if it matches currently
        // used filters. Instead, we refresh the query history list.
        // TODO: run only if Query History list is opened (#47252)
        for (const exploreId in state.panes) {
            yield dispatch(loadRichHistory(exploreId));
        }
    });
}
/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export const runQueries = createAsyncThunk('explore/runQueries', ({ exploreId, preserveCache }, { dispatch, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    dispatch(updateTime({ exploreId }));
    const correlations$ = getCorrelations(exploreId);
    // We always want to clear cache unless we explicitly pass preserveCache parameter
    if (preserveCache !== true) {
        dispatch(clearCache(exploreId));
    }
    const exploreItemState = getState().explore.panes[exploreId];
    const { datasourceInstance, containerWidth, isLive: live, range, scanning, queryResponse, querySubscription, refreshInterval, absoluteRange, cache, supplementaryQueries, correlationEditorHelperData, } = exploreItemState;
    const isCorrelationEditorMode = ((_j = getState().explore.correlationEditorDetails) === null || _j === void 0 ? void 0 : _j.editorMode) || false;
    const isLeftPane = Object.keys(getState().explore.panes)[0] === exploreId;
    const showCorrelationEditorLinks = isCorrelationEditorMode && isLeftPane;
    const defaultCorrelationEditorDatasource = showCorrelationEditorLinks ? yield getDataSourceSrv().get() : undefined;
    const interpolateCorrelationHelperVars = isCorrelationEditorMode && !isLeftPane && correlationEditorHelperData !== undefined;
    let newQuerySource;
    let newQuerySubscription;
    const queries = exploreItemState.queries.map((query) => (Object.assign(Object.assign({}, query), { datasource: query.datasource || (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.getRef()) })));
    if (datasourceInstance != null) {
        handleHistory(dispatch, getState().explore, exploreItemState.history, datasourceInstance, queries, exploreId);
    }
    const cachedValue = getResultsFromCache(cache, absoluteRange);
    // If we have results saved in cache, we are going to use those results instead of running queries
    if (cachedValue) {
        newQuerySource = combineLatest([of(cachedValue), correlations$]).pipe(mergeMap(([data, correlations]) => decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, correlations, showCorrelationEditorLinks, defaultCorrelationEditorDatasource)));
        newQuerySubscription = newQuerySource.subscribe((data) => {
            dispatch(queryStreamUpdatedAction({ exploreId, response: data }));
        });
        // If we don't have results saved in cache, run new queries
    }
    else {
        if (!hasNonEmptyQuery(queries) || !datasourceInstance) {
            return;
        }
        // Some datasource's query builders allow per-query interval limits,
        // but we're using the datasource interval limit for now
        const minInterval = datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.interval;
        stopQueryState(querySubscription);
        const queryOptions = {
            minInterval,
            // maxDataPoints is used in:
            // Loki - used for logs streaming for buffer size, with undefined it falls back to datasource config if it supports that.
            // Elastic - limits the number of datapoints for the counts query and for logs it has hardcoded limit.
            // Influx - used to correctly display logs in graph
            // TODO:unification
            // maxDataPoints: mode === ExploreMode.Logs && datasourceId === 'loki' ? undefined : containerWidth,
            maxDataPoints: containerWidth,
            liveStreaming: live,
        };
        let scopedVars = {};
        if (interpolateCorrelationHelperVars && correlationEditorHelperData !== undefined) {
            Object.entries(correlationEditorHelperData === null || correlationEditorHelperData === void 0 ? void 0 : correlationEditorHelperData.vars).forEach((variable) => {
                scopedVars[variable[0]] = { value: variable[1] };
            });
        }
        const timeZone = getTimeZone(getState().user);
        const transaction = buildQueryTransaction(exploreId, queries, queryOptions, range, scanning, timeZone, scopedVars);
        dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Loading }));
        newQuerySource = combineLatest([
            runRequest(datasourceInstance, transaction.request)
                // Simple throttle for live tailing, in case of > 1000 rows per interval we spend about 200ms on processing and
                // rendering. In case this is optimized this can be tweaked, but also it should be only as fast as user
                // actually can see what is happening.
                .pipe(live ? throttleTime(500) : identity),
            correlations$,
        ]).pipe(mergeMap(([data, correlations]) => decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, correlations, showCorrelationEditorLinks, defaultCorrelationEditorDatasource)));
        newQuerySubscription = newQuerySource.subscribe({
            next(data) {
                if (data.logsResult !== null && data.state === LoadingState.Done) {
                    reportInteraction('grafana_explore_logs_result_displayed', {
                        datasourceType: datasourceInstance.type,
                    });
                }
                dispatch(queryStreamUpdatedAction({ exploreId, response: data }));
                // Keep scanning for results if this was the last scanning transaction
                if (getState().explore.panes[exploreId].scanning) {
                    if (data.state === LoadingState.Done && data.series.length === 0) {
                        const range = getShiftedTimeRange(-1, getState().explore.panes[exploreId].range);
                        dispatch(updateTime({ exploreId, absoluteRange: range }));
                        dispatch(runQueries({ exploreId }));
                    }
                    else {
                        // We can stop scanning if we have a result
                        dispatch(scanStopAction({ exploreId }));
                    }
                }
            },
            error(error) {
                dispatch(notifyApp(createErrorNotification('Query processing error', error)));
                dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Error }));
                console.error(error);
            },
            complete() {
                // In case we don't get any response at all but the observable completed, make sure we stop loading state.
                // This is for cases when some queries are noop like running first query after load but we don't have any
                // actual query input.
                if (getState().explore.panes[exploreId].queryResponse.state === LoadingState.Loading) {
                    dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Done }));
                }
            },
        });
        if (live) {
            for (const type of supplementaryQueryTypes) {
                dispatch(cleanSupplementaryQueryDataProviderAction({
                    exploreId,
                    type,
                }));
                dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
            }
        }
        else {
            dispatch(handleSupplementaryQueries({
                exploreId,
                datasourceInstance,
                transaction,
                newQuerySource,
                supplementaryQueries,
                queries,
                absoluteRange,
            }));
        }
    }
    dispatch(queryStoreSubscriptionAction({ exploreId, querySubscription: newQuerySubscription }));
}));
const groupDataQueries = (datasources, scopedVars) => __awaiter(void 0, void 0, void 0, function* () {
    const nonMixedDataSources = datasources.filter((t) => {
        var _a;
        return ((_a = t.datasource) === null || _a === void 0 ? void 0 : _a.uid) !== MIXED_DATASOURCE_NAME;
    });
    const sets = groupBy(nonMixedDataSources, 'datasource.uid');
    return yield Promise.all(Object.values(sets).map((targets) => __awaiter(void 0, void 0, void 0, function* () {
        const datasource = yield getDataSourceSrv().get(targets[0].datasource, scopedVars);
        return {
            datasource,
            targets,
        };
    })));
});
const handleSupplementaryQueries = createAsyncThunk('explore/handleSupplementaryQueries', ({ datasourceInstance, exploreId, transaction, newQuerySource, supplementaryQueries, queries, absoluteRange, }, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    let groupedQueries;
    if (datasourceInstance.meta.mixed) {
        groupedQueries = yield groupDataQueries(transaction.request.targets, transaction.request.scopedVars);
    }
    else {
        groupedQueries = [{ datasource: datasourceInstance, targets: transaction.request.targets }];
    }
    for (const type of supplementaryQueryTypes) {
        // We always prepare provider, even is supplementary query is disabled because when the user
        // enables the query, we need to load the data, so we need the provider
        const dataProvider = getSupplementaryQueryProvider(groupedQueries, type, Object.assign(Object.assign({}, transaction.request), { requestId: `${transaction.request.requestId}_${snakeCase(type)}` }), newQuerySource);
        if (dataProvider) {
            dispatch(storeSupplementaryQueryDataProviderAction({
                exploreId,
                type,
                dataProvider,
            }));
            if (!canReuseSupplementaryQueryData(supplementaryQueries[type].data, queries, absoluteRange)) {
                dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
                if (supplementaryQueries[type].enabled) {
                    dispatch(loadSupplementaryQueryData(exploreId, type));
                }
            }
        }
        else {
            // If data source instance doesn't support this supplementary query, we clean the data provider
            dispatch(cleanSupplementaryQueryDataProviderAction({
                exploreId,
                type,
            }));
        }
    }
}));
/**
 * Checks if after changing the time range the existing data can be used to show supplementary query.
 * It can happen if queries are the same and new time range is within existing data time range.
 */
function canReuseSupplementaryQueryData(supplementaryQueryData, newQueries, selectedTimeRange) {
    if (!supplementaryQueryData) {
        return false;
    }
    const newQueriesByRefId = zipObject(map(newQueries, 'refId'), newQueries);
    const existingDataByRefId = mapValues(groupBy(supplementaryQueryData.data.map((dataFrame) => { var _a, _b; return (_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.sourceQuery; }), 'refId'), head);
    const allSupportZoomingIn = supplementaryQueryData.data.every((data) => {
        var _a, _b;
        // If log volume is based on returned log lines (i.e. LogsVolumeType.Limited),
        // zooming in may return different results, so we don't want to reuse the data
        return ((_b = (_a = data.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.logsVolumeType) === LogsVolumeType.FullRange;
    });
    const allQueriesAreTheSame = deepEqual(newQueriesByRefId, existingDataByRefId);
    const allResultsHaveWiderRange = supplementaryQueryData.data.every((data) => {
        var _a, _b;
        const dataRange = (_b = (_a = data.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.absoluteRange;
        // Only first data frame in the response may contain the absolute range
        if (!dataRange) {
            return true;
        }
        const hasWiderRange = dataRange && dataRange.from <= selectedTimeRange.from && selectedTimeRange.to <= dataRange.to;
        return hasWiderRange;
    });
    return allSupportZoomingIn && allQueriesAreTheSame && allResultsHaveWiderRange;
}
/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId, rawQueries) {
    return (dispatch, getState) => {
        // Inject react keys into query objects
        const queries = getState().explore.panes[exploreId].queries;
        const nextQueries = rawQueries.map((query, index) => generateNewKeyAndAddRefIdIfMissing(query, queries, index));
        dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
        dispatch(runQueries({ exploreId }));
    };
}
/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId) {
    return (dispatch, getState) => {
        // Register the scanner
        dispatch(scanStartAction({ exploreId }));
        // Scanning must trigger query run, and return the new range
        const range = getShiftedTimeRange(-1, getState().explore.panes[exploreId].range);
        // Set the new range to be displayed
        dispatch(updateTime({ exploreId, absoluteRange: range }));
        dispatch(runQueries({ exploreId }));
    };
}
export function addResultsToCache(exploreId) {
    return (dispatch, getState) => {
        const queryResponse = getState().explore.panes[exploreId].queryResponse;
        const absoluteRange = getState().explore.panes[exploreId].absoluteRange;
        const cacheKey = createCacheKey(absoluteRange);
        // Save results to cache only when all results received and loading is done
        if (queryResponse.state === LoadingState.Done) {
            dispatch(addResultsToCacheAction({ exploreId, cacheKey, queryResponse }));
        }
    };
}
export function clearCache(exploreId) {
    return (dispatch, getState) => {
        dispatch(clearCacheAction({ exploreId }));
    };
}
/**
 * Initializes loading logs volume data and stores emitted value.
 */
export function loadSupplementaryQueryData(exploreId, type) {
    return (dispatch, getState) => {
        const { supplementaryQueries } = getState().explore.panes[exploreId];
        const dataProvider = supplementaryQueries[type].dataProvider;
        if (dataProvider) {
            const dataSubscription = dataProvider.subscribe({
                next: (supplementaryQueryData) => {
                    dispatch(updateSupplementaryQueryDataAction({ exploreId, type, data: supplementaryQueryData }));
                },
            });
            dispatch(storeSupplementaryQueryDataSubscriptionAction({
                exploreId,
                type,
                dataSubscription,
            }));
        }
    };
}
export function setSupplementaryQueryEnabled(exploreId, enabled, type) {
    return (dispatch, getState) => {
        dispatch(setSupplementaryQueryEnabledAction({ exploreId, enabled, type }));
        storeSupplementaryQueryEnabled(enabled, type);
        if (enabled) {
            dispatch(loadSupplementaryQueryData(exploreId, type));
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
export const queryReducer = (state, action) => {
    if (addQueryRowAction.match(action)) {
        const { queries } = state;
        const { index, query } = action.payload;
        // Add to queries, which will cause a new row to be rendered
        const nextQueries = [...queries.slice(0, index + 1), Object.assign({}, query), ...queries.slice(index + 1)];
        return Object.assign(Object.assign({}, state), { queries: nextQueries, queryKeys: getQueryKeys(nextQueries) });
    }
    if (changeQueriesAction.match(action)) {
        const { queries } = action.payload;
        return Object.assign(Object.assign({}, state), { queries });
    }
    if (cancelQueriesAction.match(action)) {
        stopQueryState(state.querySubscription);
        return Object.assign(Object.assign({}, state), { queryResponse: Object.assign(Object.assign({}, state.queryResponse), { state: LoadingState.Done }) });
    }
    if (setQueriesAction.match(action)) {
        const { queries } = action.payload;
        return Object.assign(Object.assign({}, state), { queries: queries.slice(), queryKeys: getQueryKeys(queries) });
    }
    if (queryStoreSubscriptionAction.match(action)) {
        const { querySubscription } = action.payload;
        return Object.assign(Object.assign({}, state), { querySubscription });
    }
    if (setSupplementaryQueryEnabledAction.match(action)) {
        const { enabled, type } = action.payload;
        const { supplementaryQueries } = state;
        const dataSubscription = supplementaryQueries[type].dataSubscription;
        if (!enabled && dataSubscription) {
            dataSubscription.unsubscribe();
        }
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { 
            // NOTE: the dataProvider is not cleared, we may need it later,
            // if the user re-enables the supplementary query
            [type]: Object.assign(Object.assign({}, supplementaryQueries[type]), { enabled, data: undefined }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (storeSupplementaryQueryDataProviderAction.match(action)) {
        const { dataProvider, type } = action.payload;
        const { supplementaryQueries } = state;
        const supplementaryQuery = supplementaryQueries[type];
        if (supplementaryQuery === null || supplementaryQuery === void 0 ? void 0 : supplementaryQuery.dataSubscription) {
            supplementaryQuery.dataSubscription.unsubscribe();
        }
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { [type]: Object.assign(Object.assign({}, supplementaryQuery), { dataProvider, dataSubscription: undefined }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (cleanSupplementaryQueryDataProviderAction.match(action)) {
        const { type } = action.payload;
        const { supplementaryQueries } = state;
        const supplementaryQuery = supplementaryQueries[type];
        if (supplementaryQuery === null || supplementaryQuery === void 0 ? void 0 : supplementaryQuery.dataSubscription) {
            supplementaryQuery.dataSubscription.unsubscribe();
        }
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { [type]: Object.assign(Object.assign({}, supplementaryQuery), { dataProvider: undefined, dataSubscription: undefined }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (cleanSupplementaryQueryAction.match(action)) {
        const { type } = action.payload;
        const { supplementaryQueries } = state;
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { [type]: Object.assign(Object.assign({}, supplementaryQueries[type]), { data: undefined }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (storeSupplementaryQueryDataSubscriptionAction.match(action)) {
        const { dataSubscription, type } = action.payload;
        const { supplementaryQueries } = state;
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { [type]: Object.assign(Object.assign({}, supplementaryQueries[type]), { dataSubscription }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (updateSupplementaryQueryDataAction.match(action)) {
        let { data, type } = action.payload;
        const { supplementaryQueries } = state;
        const nextSupplementaryQueries = Object.assign(Object.assign({}, supplementaryQueries), { [type]: Object.assign(Object.assign({}, supplementaryQueries[type]), { data }) });
        return Object.assign(Object.assign({}, state), { supplementaryQueries: nextSupplementaryQueries });
    }
    if (queryStreamUpdatedAction.match(action)) {
        return processQueryResponse(state, action);
    }
    if (queriesImportedAction.match(action)) {
        const { queries } = action.payload;
        return Object.assign(Object.assign({}, state), { queries, queryKeys: getQueryKeys(queries) });
    }
    if (changeLoadingStateAction.match(action)) {
        const { loadingState } = action.payload;
        return Object.assign(Object.assign({}, state), { queryResponse: Object.assign(Object.assign({}, state.queryResponse), { state: loadingState }) });
    }
    if (setPausedStateAction.match(action)) {
        const { isPaused } = action.payload;
        return Object.assign(Object.assign({}, state), { isPaused: isPaused });
    }
    if (scanStartAction.match(action)) {
        return Object.assign(Object.assign({}, state), { scanning: true });
    }
    if (scanStopAction.match(action)) {
        return Object.assign(Object.assign({}, state), { scanning: false, scanRange: undefined });
    }
    if (addResultsToCacheAction.match(action)) {
        const CACHE_LIMIT = 5;
        const { cache } = state;
        const { queryResponse, cacheKey } = action.payload;
        let newCache = [...cache];
        const isDuplicateKey = newCache.some((c) => c.key === cacheKey);
        if (!isDuplicateKey) {
            const newCacheItem = { key: cacheKey, value: queryResponse };
            newCache = [newCacheItem, ...newCache].slice(0, CACHE_LIMIT);
        }
        return Object.assign(Object.assign({}, state), { cache: newCache });
    }
    if (clearCacheAction.match(action)) {
        return Object.assign(Object.assign({}, state), { cache: [] });
    }
    if (clearLogs.match(action)) {
        if (!state.logsResult) {
            return Object.assign(Object.assign({}, state), { clearedAtIndex: null });
        }
        // When in loading state, clear logs and set clearedAtIndex as null.
        // Initially loaded logs will be fully replaced by incoming streamed logs, which may have a different length.
        if (state.queryResponse.state === LoadingState.Loading) {
            return Object.assign(Object.assign({}, state), { clearedAtIndex: null, logsResult: Object.assign(Object.assign({}, state.logsResult), { rows: [] }) });
        }
        const lastItemIndex = state.clearedAtIndex
            ? state.clearedAtIndex + state.logsResult.rows.length
            : state.logsResult.rows.length - 1;
        return Object.assign(Object.assign({}, state), { clearedAtIndex: lastItemIndex, logsResult: Object.assign(Object.assign({}, state.logsResult), { rows: [] }) });
    }
    return state;
};
export const processQueryResponse = (state, action) => {
    var _a, _b, _c, _d;
    const { response } = action.payload;
    const { request, series, error, graphResult, logsResult, tableResult, rawPrometheusResult, traceFrames, nodeGraphFrames, flameGraphFrames, rawPrometheusFrames, customFrames, } = response;
    if (error) {
        if (error.type === DataQueryErrorType.Timeout || error.type === DataQueryErrorType.Cancelled) {
            return Object.assign({}, state);
        }
        // Send error to Angular editors
        // When angularSupportEnabled is removed we can remove this code and all references to eventBridge
        if (config.angularSupportEnabled && ((_b = (_a = state.datasourceInstance) === null || _a === void 0 ? void 0 : _a.components) === null || _b === void 0 ? void 0 : _b.QueryCtrl)) {
            state.eventBridge.emit(PanelEvents.dataError, error);
        }
    }
    if (!request) {
        return Object.assign({}, state);
    }
    // Send legacy data to Angular editors
    // When angularSupportEnabled is removed we can remove this code and all references to eventBridge
    if (config.angularSupportEnabled && ((_d = (_c = state.datasourceInstance) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.QueryCtrl)) {
        const legacy = series.map((v) => toLegacyResponseData(v));
        state.eventBridge.emit(PanelEvents.dataReceived, legacy);
    }
    return Object.assign(Object.assign({}, state), { queryResponse: response, graphResult,
        tableResult,
        rawPrometheusResult, logsResult: state.isLive && logsResult
            ? Object.assign(Object.assign({}, logsResult), { rows: filterLogRowsByIndex(state.clearedAtIndex, logsResult.rows) }) : logsResult, showLogs: !!logsResult, showMetrics: !!graphResult, showTable: !!(tableResult === null || tableResult === void 0 ? void 0 : tableResult.length), showTrace: !!traceFrames.length, showNodeGraph: !!nodeGraphFrames.length, showRawPrometheus: !!rawPrometheusFrames.length, showFlameGraph: !!flameGraphFrames.length, showCustom: !!(customFrames === null || customFrames === void 0 ? void 0 : customFrames.length), clearedAtIndex: state.isLive ? state.clearedAtIndex : null });
};
//# sourceMappingURL=query.js.map