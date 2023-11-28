import { __awaiter } from "tslib";
import { identity, isEmpty, isEqual, isObject, mapValues, omitBy } from 'lodash';
import { useEffect, useRef } from 'react';
import { CoreApp, toURLRange } from '@grafana/data';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { clearQueryKeys, getLastUsedDatasourceUID } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { addListener, useDispatch, useSelector } from 'app/types';
import { changeDatasource } from '../../state/datasource';
import { initializeExplore } from '../../state/explorePane';
import { clearPanes, splitClose, splitOpen, syncTimesAction } from '../../state/main';
import { runQueries, setQueriesAction } from '../../state/query';
import { selectPanes } from '../../state/selectors';
import { changeRangeAction, updateTime } from '../../state/time';
import { DEFAULT_RANGE, fromURLRange } from '../../state/utils';
import { withUniqueRefIds } from '../../utils/queries';
import { isFulfilled } from '../utils';
import { parseURL } from './parseURL';
/**
 * Bi-directionally syncs URL changes with Explore's state.
 */
export function useStateSync(params) {
    const { location } = useGrafana();
    const dispatch = useDispatch();
    const panesState = useSelector(selectPanes);
    const orgId = useSelector((state) => state.user.orgId);
    const prevParams = useRef(params);
    const initState = useRef('notstarted');
    useEffect(() => {
        // This happens when the user navigates to an explore "empty page" while within Explore.
        // ie. by clicking on the explore when explore is active.
        if (!params.panes) {
            initState.current = 'notstarted';
            prevParams.current = params;
        }
    }, [params]);
    useEffect(() => {
        const unsubscribe = dispatch(addListener({
            predicate: (action) => 
            // We want to update the URL when:
            // - a pane is opened or closed
            // - a query is run
            // - range is changed
            [splitClose.type, splitOpen.fulfilled.type, runQueries.pending.type, changeRangeAction.type].includes(action.type),
            effect: (_, { cancelActiveListeners, delay, getState }) => __awaiter(this, void 0, void 0, function* () {
                // The following 2 lines will throttle updates to avoid creating history entries when rapid changes
                // are committed to the store.
                cancelActiveListeners();
                yield delay(200);
                const panesQueryParams = Object.entries(getState().explore.panes).reduce((acc, [id, paneState]) => {
                    if (!paneState) {
                        return acc;
                    }
                    return Object.assign(Object.assign({}, acc), { [id]: getUrlStateFromPaneState(paneState) });
                }, {});
                if (!isEqual(prevParams.current.panes, JSON.stringify(panesQueryParams))) {
                    // If there's no previous state it means we are mounting explore for the first time,
                    // in this case we want to replace the URL instead of pushing a new entry to the history.
                    const replace = !!prevParams.current.panes && Object.values(prevParams.current.panes).filter(Boolean).length === 0;
                    prevParams.current = {
                        panes: JSON.stringify(panesQueryParams),
                    };
                    location.partial({ panes: prevParams.current.panes }, replace);
                }
            }),
        }));
        // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
        return () => unsubscribe();
    }, [dispatch, location]);
    useEffect(() => {
        var _a;
        const isURLOutOfSync = ((_a = prevParams.current) === null || _a === void 0 ? void 0 : _a.panes) !== params.panes;
        const urlState = parseURL(params);
        function sync() {
            return __awaiter(this, void 0, void 0, function* () {
                // if navigating the history causes one of the time range to not being equal to all the other ones,
                // we set syncedTimes to false to avoid inconsistent UI state.
                // Ideally `syncedTimes` should be saved in the URL.
                if (Object.values(urlState.panes).some(({ range }, _, [{ range: firstRange }]) => !isEqual(range, firstRange))) {
                    dispatch(syncTimesAction({ syncedTimes: false }));
                }
                Object.entries(urlState.panes).forEach(([exploreId, urlPane], i) => {
                    const { datasource, queries, range, panelsState } = urlPane;
                    const paneState = panesState[exploreId];
                    if (paneState !== undefined) {
                        const update = urlDiff(urlPane, getUrlStateFromPaneState(paneState));
                        Promise.resolve()
                            .then(() => __awaiter(this, void 0, void 0, function* () {
                            if (update.datasource && datasource) {
                                yield dispatch(changeDatasource(exploreId, datasource));
                            }
                            return;
                        }))
                            .then(() => {
                            if (update.range) {
                                dispatch(updateTime({ exploreId, rawRange: fromURLRange(range) }));
                            }
                            if (update.queries) {
                                dispatch(setQueriesAction({ exploreId, queries: withUniqueRefIds(queries) }));
                            }
                            if (update.queries || update.range) {
                                dispatch(runQueries({ exploreId }));
                            }
                        });
                    }
                    else {
                        // This happens when browser history is used to navigate.
                        // In this case we want to initialize the pane with the data from the URL
                        // if it's not present in the store. This may happen if the user has navigated
                        // from split view to non-split view and then back to split view.
                        dispatch(initializeExplore({
                            exploreId,
                            datasource: datasource || '',
                            queries: withUniqueRefIds(queries),
                            range: fromURLRange(range),
                            panelsState,
                            position: i,
                        }));
                    }
                });
                // Close all the panes that are not in the URL but are still in the store
                // ie. because the user has navigated back after opening the split view.
                Object.keys(panesState)
                    .filter((keyInStore) => !Object.keys(urlState.panes).includes(keyInStore))
                    .forEach((paneId) => dispatch(splitClose(paneId)));
            });
        }
        // This happens when the user first navigates to explore.
        // Here we want to initialize each pane initial data, wether it comes
        // from the url or as a result of migrations.
        if (!isURLOutOfSync && initState.current === 'notstarted') {
            initState.current = 'pending';
            // Clear all the panes in the store first to avoid stale data.
            dispatch(clearPanes());
            Promise.all(Object.entries(urlState.panes).map(([exploreId, { datasource, queries, range, panelsState }]) => {
                return getPaneDatasource(datasource, queries, orgId).then((paneDatasource) => {
                    return Promise.resolve(
                    // Given the Grafana datasource will always be present, this should always be defined.
                    paneDatasource
                        ? queries.length
                            ? // if we have queries in the URL, we use them
                                withUniqueRefIds(queries)
                                    // but filter out the ones that are not compatible with the pane datasource
                                    .filter(getQueryFilter(paneDatasource))
                                    .map(isMixedDatasource(paneDatasource)
                                    ? identity
                                    : (query) => (Object.assign(Object.assign({}, query), { datasource: paneDatasource.getRef() })))
                            : getDatasourceSrv()
                                // otherwise we get a default query from the pane datasource or from the default datasource if the pane datasource is mixed
                                .get(isMixedDatasource(paneDatasource) ? undefined : paneDatasource.getRef())
                                .then((ds) => [getDefaultQuery(ds)])
                        : []).then((queries) => __awaiter(this, void 0, void 0, function* () {
                        // we remove queries that have an invalid datasources
                        let validQueries = yield removeQueriesWithInvalidDatasource(queries);
                        if (!validQueries.length && paneDatasource) {
                            // and in case there's no query left we add a default one.
                            validQueries = [
                                getDefaultQuery(isMixedDatasource(paneDatasource) ? yield getDatasourceSrv().get() : paneDatasource),
                            ];
                        }
                        return { exploreId, range, panelsState, queries: validQueries, datasource: paneDatasource };
                    }));
                });
            })).then((panes) => __awaiter(this, void 0, void 0, function* () {
                const initializedPanes = yield Promise.all(panes.map(({ exploreId, range, panelsState, queries, datasource }) => {
                    return dispatch(initializeExplore({
                        exploreId,
                        datasource,
                        queries,
                        range: fromURLRange(range),
                        panelsState,
                    })).unwrap();
                }));
                const newParams = initializedPanes.reduce((acc, { exploreId, state }) => {
                    return Object.assign(Object.assign({}, acc), { panes: Object.assign(Object.assign({}, acc.panes), { [exploreId]: getUrlStateFromPaneState(state) }) });
                }, {
                    panes: {},
                });
                initState.current = 'done';
                // we need to use partial here beacuse replace doesn't encode the query params.
                location.partial(Object.assign(Object.assign({}, Object.keys(location.getSearchObject()).reduce((acc, key) => {
                    acc[key] = undefined;
                    return acc;
                }, {})), { panes: JSON.stringify(newParams.panes), schemaVersion: urlState.schemaVersion, orgId }), true);
            }));
        }
        prevParams.current = params;
        isURLOutOfSync && initState.current === 'done' && sync();
    }, [dispatch, panesState, orgId, location, params]);
}
function getDefaultQuery(ds) {
    var _a;
    return Object.assign(Object.assign({}, (_a = ds.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(ds, CoreApp.Explore)), { refId: 'A', datasource: ds.getRef() });
}
function isMixedDatasource(datasource) {
    return datasource.name === MIXED_DATASOURCE_NAME;
}
function getQueryFilter(datasource) {
    // if the root datasource is mixed, filter out queries that don't have a datasource.
    if (datasource && isMixedDatasource(datasource)) {
        return (q) => !!q.datasource;
    }
    else {
        // else filter out queries that have a datasource different from the root one.
        // Queries may not have a datasource, if so, it's assumed they are using the root datasource
        return (q) => {
            if (!q.datasource) {
                return true;
            }
            // Due to legacy URLs, `datasource` in queries may be a string. This logic should probably be in the migration
            if (typeof q.datasource === 'string') {
                return q.datasource === (datasource === null || datasource === void 0 ? void 0 : datasource.uid);
            }
            return q.datasource.uid === (datasource === null || datasource === void 0 ? void 0 : datasource.uid);
        };
    }
}
function removeQueriesWithInvalidDatasource(queries) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield Promise.allSettled(queries.map((query) => {
            return getDatasourceSrv()
                .get(query.datasource)
                .then((ds) => ({
                query,
                ds,
            }));
        }));
        return results.filter(isFulfilled).map(({ value }) => value.query);
    });
}
/**
 * Returns the datasource that an explore pane should be using.
 * If the URL specifies a datasource and that datasource exists, it will be used unless said datasource is mixed.
 * Otherwise the datasource will be extracetd from the the first query specifying a valid datasource.
 *
 * If there's no datasource in the queries, the last used datasource will be used.
 * if there's no last used datasource, the default datasource will be used.
 *
 * @param rootDatasource the top-level datasource specified in the URL
 * @param queries the queries in the pane
 * @param orgId the orgId of the user
 *
 * @returns the datasource UID that the pane should use, undefined if no suitable datasource is found
 */
function getPaneDatasource(rootDatasource, queries, orgId) {
    return __awaiter(this, void 0, void 0, function* () {
        // If there's a root datasource, use it unless it's unavailable
        if (rootDatasource) {
            try {
                return yield getDatasourceSrv().get(rootDatasource);
            }
            catch (_) { }
        }
        // TODO: if queries have multiple datasources we should return mixed datasource
        // Else we try to find a datasource in the queries, returning the first one that exists
        const queriesWithDS = queries.filter((q) => q.datasource);
        for (const query of queriesWithDS) {
            try {
                return yield getDatasourceSrv().get(query.datasource);
            }
            catch (_) { }
        }
        // If none of the queries specify a avalid datasource, we use the last used one
        const lastUsedDSUID = getLastUsedDatasourceUID(orgId);
        return (getDatasourceSrv()
            .get(lastUsedDSUID)
            // Or the default one
            .catch(() => getDatasourceSrv().get())
            .catch(() => undefined));
    });
}
/**
 * Compare 2 explore urls and return a map of what changed. Used to update the local state with all the
 * side effects needed.
 */
const urlDiff = (oldUrlState, currentUrlState) => {
    const datasource = !isEqual(currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.datasource, oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.datasource);
    const queries = !isEqual(currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.queries, oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.queries);
    const range = !isEqual((currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.range) || DEFAULT_RANGE, (oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.range) || DEFAULT_RANGE);
    const panelsState = !isEqual(currentUrlState === null || currentUrlState === void 0 ? void 0 : currentUrlState.panelsState, oldUrlState === null || oldUrlState === void 0 ? void 0 : oldUrlState.panelsState);
    return {
        datasource,
        queries,
        range,
        panelsState,
    };
};
export function getUrlStateFromPaneState(pane) {
    var _a;
    return {
        // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
        // lets just fallback instead of crashing.
        datasource: ((_a = pane.datasourceInstance) === null || _a === void 0 ? void 0 : _a.uid) || '',
        queries: pane.queries.map(clearQueryKeys),
        range: toURLRange(pane.range.raw),
        // don't include panelsState in the url unless a piece of state is actually set
        panelsState: pruneObject(pane.panelsState),
    };
}
/**
 * recursively walks an object, removing keys where the value is undefined
 * if the resulting object is empty, returns undefined
 **/
function pruneObject(obj) {
    let pruned = mapValues(obj, (value) => (isObject(value) ? pruneObject(value) : value));
    pruned = omitBy(pruned, isEmpty);
    if (isEmpty(pruned)) {
        return undefined;
    }
    return pruned;
}
//# sourceMappingURL=index.js.map