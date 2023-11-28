import { __awaiter, __rest } from "tslib";
import { nanoid } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { CoreApp, DefaultTimeZone, LogsDedupStrategy, LogsSortOrder, rangeUtil, toURLRange, urlUtil, } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import store from 'app/core/store';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { config } from '../config';
import { getNextRefIdChar } from './query';
export const DEFAULT_UI_STATE = {
    dedupStrategy: LogsDedupStrategy.none,
};
const MAX_HISTORY_ITEMS = 100;
const LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
const lastUsedDatasourceKeyForOrgId = (orgId) => `${LAST_USED_DATASOURCE_KEY}.${orgId}`;
export const getLastUsedDatasourceUID = (orgId) => store.getObject(lastUsedDatasourceKeyForOrgId(orgId));
export const setLastUsedDatasourceUID = (orgId, datasourceUID) => store.setObject(lastUsedDatasourceKeyForOrgId(orgId), datasourceUID);
export function generateExploreId() {
    return nanoid(3);
}
/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 */
export function getExploreUrl(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const { queries, dsRef, timeRange, scopedVars } = args;
        let exploreDatasource = yield getDataSourceSrv().get(dsRef);
        /*
         * Explore does not support expressions so filter those out
         */
        let exploreTargets = queries.filter((t) => { var _a; return ((_a = t.datasource) === null || _a === void 0 ? void 0 : _a.uid) !== ExpressionDatasourceUID; });
        let url;
        if (exploreDatasource) {
            let state = { range: toURLRange(timeRange.raw) };
            if (exploreDatasource.interpolateVariablesInQueries) {
                state = Object.assign(Object.assign({}, state), { datasource: exploreDatasource.uid, queries: exploreDatasource.interpolateVariablesInQueries(exploreTargets, scopedVars !== null && scopedVars !== void 0 ? scopedVars : {}) });
            }
            else {
                state = Object.assign(Object.assign({}, state), { datasource: exploreDatasource.uid, queries: exploreTargets });
            }
            const exploreState = JSON.stringify({ [generateExploreId()]: state });
            url = urlUtil.renderUrl('/explore', { panes: exploreState, schemaVersion: 1 });
        }
        return url;
    });
}
export function buildQueryTransaction(exploreId, queries, queryOptions, range, scanning, timeZone, scopedVars) {
    const key = queries.reduce((combinedKey, query) => {
        combinedKey += query.key;
        return combinedKey;
    }, '');
    const { interval, intervalMs } = getIntervals(range, queryOptions.minInterval, queryOptions.maxDataPoints);
    // Most datasource is using `panelId + query.refId` for cancellation logic.
    // Using `format` here because it relates to the view panel that the request is for.
    // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
    // Therefore panel id has to be unique.
    const panelId = `${key}`;
    const request = {
        app: CoreApp.Explore,
        // TODO probably should be taken from preferences but does not seem to be used anyway.
        timezone: timeZone || DefaultTimeZone,
        startTime: Date.now(),
        interval,
        intervalMs,
        // TODO: the query request expects number and we are using string here. Seems like it works so far but can create
        // issues down the road.
        panelId: panelId,
        targets: queries,
        range,
        requestId: 'explore_' + exploreId,
        rangeRaw: range.raw,
        scopedVars: Object.assign({ __interval: { text: interval, value: interval }, __interval_ms: { text: intervalMs, value: intervalMs } }, scopedVars),
        maxDataPoints: queryOptions.maxDataPoints,
        liveStreaming: queryOptions.liveStreaming,
    };
    return {
        queries,
        request,
        scanning,
        id: generateKey(),
        done: false,
    };
}
export const clearQueryKeys = (_a) => {
    var { key } = _a, rest = __rest(_a, ["key"]);
    return rest;
};
export const safeParseJson = (text) => {
    if (!text) {
        return;
    }
    try {
        return JSON.parse(text);
    }
    catch (error) {
        console.error(error);
    }
};
export const safeStringifyValue = (value, space) => {
    if (value === undefined || value === null) {
        return '';
    }
    try {
        return JSON.stringify(value, null, space);
    }
    catch (error) {
        console.error(error);
    }
    return '';
};
export function generateKey(index = 0) {
    return `Q-${uuidv4()}-${index}`;
}
export function generateEmptyQuery(queries, index = 0, dataSourceOverride) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        let datasourceInstance;
        let datasourceRef;
        let defaultQuery;
        // datasource override is if we have switched datasources with no carry-over - we want to create a new query with a datasource we define
        // it's also used if there's a root datasource and there were no previous queries
        if (dataSourceOverride) {
            datasourceRef = dataSourceOverride;
        }
        else if (queries.length > 0 && queries[queries.length - 1].datasource) {
            // otherwise use last queries' datasource
            datasourceRef = queries[queries.length - 1].datasource;
        }
        else {
            datasourceInstance = yield getDataSourceSrv().get();
            defaultQuery = (_a = datasourceInstance.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(datasourceInstance, CoreApp.Explore);
            datasourceRef = datasourceInstance.getRef();
        }
        if (!datasourceInstance) {
            datasourceInstance = yield getDataSourceSrv().get(datasourceRef);
            defaultQuery = (_b = datasourceInstance.getDefaultQuery) === null || _b === void 0 ? void 0 : _b.call(datasourceInstance, CoreApp.Explore);
        }
        return Object.assign(Object.assign({}, defaultQuery), { refId: getNextRefIdChar(queries), key: generateKey(index), datasource: datasourceRef });
    });
}
export const generateNewKeyAndAddRefIdIfMissing = (target, queries, index = 0) => {
    const key = generateKey(index);
    const refId = target.refId || getNextRefIdChar(queries);
    return Object.assign(Object.assign({}, target), { refId, key });
};
/**
 * Ensure at least one target exists and that targets have the necessary keys
 *
 * This will return an empty array if there are no datasources, as Explore is not usable in that state
 */
export function ensureQueries(queries, newQueryDataSourceOverride) {
    return __awaiter(this, void 0, void 0, function* () {
        if (queries && typeof queries === 'object' && queries.length > 0) {
            const allQueries = [];
            for (let index = 0; index < queries.length; index++) {
                const query = queries[index];
                const key = generateKey(index);
                let refId = query.refId;
                if (!refId) {
                    refId = getNextRefIdChar(allQueries);
                }
                // if a query has a datasource, validate it and only add it if valid
                // if a query doesn't have a datasource, do not worry about it at this step
                let validDS = true;
                if (query.datasource) {
                    try {
                        yield getDataSourceSrv().get(query.datasource.uid);
                    }
                    catch (_a) {
                        console.error(`One of the queries has a datasource that is no longer available and was removed.`);
                        validDS = false;
                    }
                }
                if (validDS) {
                    allQueries.push(Object.assign(Object.assign({}, query), { refId,
                        key }));
                }
            }
            return allQueries;
        }
        try {
            // if a datasource override get its ref, otherwise get the default datasource
            const emptyQueryRef = newQueryDataSourceOverride !== null && newQueryDataSourceOverride !== void 0 ? newQueryDataSourceOverride : (yield getDataSourceSrv().get()).getRef();
            const emptyQuery = yield generateEmptyQuery(queries !== null && queries !== void 0 ? queries : [], undefined, emptyQueryRef);
            return [emptyQuery];
        }
        catch (_b) {
            // if there are no datasources, return an empty array because we will not allow use of explore
            // this will occur on init of explore with no datasources defined
            return [];
        }
    });
}
/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key, context and datasource.
 * FIXME: While this is reasonable for practical use cases, a query without any propery might still be "non-empty"
 * in its own scope, for instance when there's no user input needed. This might be the case for an hypothetic datasource in
 * which query options are only set in its config and the query object itself, as generated from its query editor it's always "empty"
 */
const validKeys = ['refId', 'key', 'context', 'datasource'];
export function hasNonEmptyQuery(queries) {
    return (queries &&
        queries.some((query) => {
            const keys = Object.keys(query)
                .filter((key) => validKeys.indexOf(key) === -1)
                .map((k) => query[k])
                .filter((v) => v);
            return keys.length > 0;
        }));
}
/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory(history, datasourceId, queries) {
    const ts = Date.now();
    let updatedHistory = history;
    queries.forEach((query) => {
        updatedHistory = [{ query, ts }, ...updatedHistory];
    });
    if (updatedHistory.length > MAX_HISTORY_ITEMS) {
        updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
    }
    // Combine all queries of a datasource type into one history
    const historyKey = `grafana.explore.history.${datasourceId}`;
    try {
        store.setObject(historyKey, updatedHistory);
        return updatedHistory;
    }
    catch (error) {
        console.error(error);
        return history;
    }
}
export const getQueryKeys = (queries) => {
    const queryKeys = queries.reduce((newQueryKeys, query, index) => {
        var _a;
        const primaryKey = ((_a = query.datasource) === null || _a === void 0 ? void 0 : _a.uid) || query.key;
        return newQueryKeys.concat(`${primaryKey}-${index}`);
    }, []);
    return queryKeys;
};
export const getTimeRange = (timeZone, rawRange, fiscalYearStartMonth) => {
    let range = rangeUtil.convertRawToRange(rawRange, timeZone, fiscalYearStartMonth);
    if (range.to.isBefore(range.from)) {
        range = rangeUtil.convertRawToRange({ from: range.raw.to, to: range.raw.from }, timeZone, fiscalYearStartMonth);
    }
    return range;
};
export const refreshIntervalToSortOrder = (refreshInterval) => RefreshPicker.isLive(refreshInterval) ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
export const convertToWebSocketUrl = (url) => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
    if (backend.endsWith('/')) {
        backend = backend.slice(0, -1);
    }
    return `${backend}${url}`;
};
export const stopQueryState = (querySubscription) => {
    if (querySubscription) {
        querySubscription.unsubscribe();
    }
};
export function getIntervals(range, lowLimit, resolution) {
    if (!resolution) {
        return { interval: '1s', intervalMs: 1000 };
    }
    return rangeUtil.calculateInterval(range, resolution, lowLimit);
}
export const copyStringToClipboard = (string) => {
    const el = document.createElement('textarea');
    el.value = string;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
};
//# sourceMappingURL=explore.js.map