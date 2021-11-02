import { __assign, __awaiter, __generator, __read, __rest, __spreadArray, __values } from "tslib";
// Libraries
import { flatten, omit, uniq } from 'lodash';
// Services & Utils
import { CoreApp, dateMath, DefaultTimeZone, LogsDedupStrategy, LogsSortOrder, toUtc, urlUtil, rangeUtil, isDateTime, } from '@grafana/data';
import store from 'app/core/store';
import { v4 as uuidv4 } from 'uuid';
import { getNextRefIdChar } from './query';
// Types
import { RefreshPicker } from '@grafana/ui';
import { config } from '../config';
export var DEFAULT_RANGE = {
    from: 'now-1h',
    to: 'now',
};
export var DEFAULT_UI_STATE = {
    dedupStrategy: LogsDedupStrategy.none,
};
var MAX_HISTORY_ITEMS = 100;
export var LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
export var lastUsedDatasourceKeyForOrgId = function (orgId) { return LAST_USED_DATASOURCE_KEY + "." + orgId; };
/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 */
export function getExploreUrl(args) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var panel, datasourceSrv, timeSrv, exploreDatasource, exploreTargets, url, _loop_1, exploreTargets_1, exploreTargets_1_1, t, state_1, e_1_1, range, state, scopedVars, exploreState;
        var e_1, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    panel = args.panel, datasourceSrv = args.datasourceSrv, timeSrv = args.timeSrv;
                    return [4 /*yield*/, datasourceSrv.get(panel.datasource)];
                case 1:
                    exploreDatasource = _c.sent();
                    exploreTargets = panel.targets.map(function (t) { return omit(t, 'legendFormat'); });
                    if (!(((_a = exploreDatasource.meta) === null || _a === void 0 ? void 0 : _a.id) === 'mixed' && exploreTargets)) return [3 /*break*/, 9];
                    _loop_1 = function (t) {
                        var datasource;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, datasourceSrv.get(t.datasource || undefined)];
                                case 1:
                                    datasource = _d.sent();
                                    if (datasource) {
                                        exploreDatasource = datasource;
                                        exploreTargets = panel.targets.filter(function (t) { return t.datasource === datasource.name; });
                                        return [2 /*return*/, "break"];
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 7, 8, 9]);
                    exploreTargets_1 = __values(exploreTargets), exploreTargets_1_1 = exploreTargets_1.next();
                    _c.label = 3;
                case 3:
                    if (!!exploreTargets_1_1.done) return [3 /*break*/, 6];
                    t = exploreTargets_1_1.value;
                    return [5 /*yield**/, _loop_1(t)];
                case 4:
                    state_1 = _c.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 6];
                    _c.label = 5;
                case 5:
                    exploreTargets_1_1 = exploreTargets_1.next();
                    return [3 /*break*/, 3];
                case 6: return [3 /*break*/, 9];
                case 7:
                    e_1_1 = _c.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 9];
                case 8:
                    try {
                        if (exploreTargets_1_1 && !exploreTargets_1_1.done && (_b = exploreTargets_1.return)) _b.call(exploreTargets_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 9:
                    if (exploreDatasource) {
                        range = timeSrv.timeRangeForUrl();
                        state = { range: range };
                        if (exploreDatasource.interpolateVariablesInQueries) {
                            scopedVars = panel.scopedVars || {};
                            state = __assign(__assign({}, state), { datasource: exploreDatasource.name, context: 'explore', queries: exploreDatasource.interpolateVariablesInQueries(exploreTargets, scopedVars) });
                        }
                        else {
                            state = __assign(__assign({}, state), { datasource: exploreDatasource.name, context: 'explore', queries: exploreTargets.map(function (t) { return (__assign(__assign({}, t), { datasource: exploreDatasource.getRef() })); }) });
                        }
                        exploreState = JSON.stringify(__assign(__assign({}, state), { originPanelId: panel.id }));
                        url = urlUtil.renderUrl('/explore', { left: exploreState });
                    }
                    return [2 /*return*/, url];
            }
        });
    });
}
export function buildQueryTransaction(exploreId, queries, queryOptions, range, scanning, timeZone) {
    var key = queries.reduce(function (combinedKey, query) {
        combinedKey += query.key;
        return combinedKey;
    }, '');
    var _a = getIntervals(range, queryOptions.minInterval, queryOptions.maxDataPoints), interval = _a.interval, intervalMs = _a.intervalMs;
    // Most datasource is using `panelId + query.refId` for cancellation logic.
    // Using `format` here because it relates to the view panel that the request is for.
    // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
    // Therefore panel id has to be unique.
    var panelId = "" + key;
    var request = {
        app: CoreApp.Explore,
        dashboardId: 0,
        // TODO probably should be taken from preferences but does not seem to be used anyway.
        timezone: timeZone || DefaultTimeZone,
        startTime: Date.now(),
        interval: interval,
        intervalMs: intervalMs,
        // TODO: the query request expects number and we are using string here. Seems like it works so far but can create
        // issues down the road.
        panelId: panelId,
        targets: queries,
        range: range,
        requestId: 'explore_' + exploreId,
        rangeRaw: range.raw,
        scopedVars: {
            __interval: { text: interval, value: interval },
            __interval_ms: { text: intervalMs, value: intervalMs },
        },
        maxDataPoints: queryOptions.maxDataPoints,
        liveStreaming: queryOptions.liveStreaming,
    };
    return {
        queries: queries,
        request: request,
        scanning: scanning,
        id: generateKey(),
        done: false,
    };
}
export var clearQueryKeys = function (_a) {
    var key = _a.key, rest = __rest(_a, ["key"]);
    return rest;
};
var isSegment = function (segment) {
    var props = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        props[_i - 1] = arguments[_i];
    }
    return props.some(function (prop) { return segment.hasOwnProperty(prop); });
};
var ParseUrlStateIndex;
(function (ParseUrlStateIndex) {
    ParseUrlStateIndex[ParseUrlStateIndex["RangeFrom"] = 0] = "RangeFrom";
    ParseUrlStateIndex[ParseUrlStateIndex["RangeTo"] = 1] = "RangeTo";
    ParseUrlStateIndex[ParseUrlStateIndex["Datasource"] = 2] = "Datasource";
    ParseUrlStateIndex[ParseUrlStateIndex["SegmentsStart"] = 3] = "SegmentsStart";
})(ParseUrlStateIndex || (ParseUrlStateIndex = {}));
export var safeParseJson = function (text) {
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
export var safeStringifyValue = function (value, space) {
    if (!value) {
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
export var EXPLORE_GRAPH_STYLES = ['lines', 'bars', 'points', 'stacked_lines', 'stacked_bars'];
var DEFAULT_GRAPH_STYLE = 'lines';
// we use this function to take any kind of data we loaded
// from an external source (URL, localStorage, whatever),
// and extract the graph-style from it, or return the default
// graph-style if we are not able to do that.
// it is important that this function is able to take any form of data,
// (be it objects, or arrays, or booleans or whatever),
// and produce a best-effort graphStyle.
// note that typescript makes sure we make no mistake in this function.
// we do not rely on ` as ` or ` any `.
export var toGraphStyle = function (data) {
    var found = EXPLORE_GRAPH_STYLES.find(function (v) { return v === data; });
    return found !== null && found !== void 0 ? found : DEFAULT_GRAPH_STYLE;
};
export function parseUrlState(initial) {
    var parsed = safeParseJson(initial);
    var errorResult = {
        datasource: null,
        queries: [],
        range: DEFAULT_RANGE,
        mode: null,
        originPanelId: null,
    };
    if (!parsed) {
        return errorResult;
    }
    if (!Array.isArray(parsed)) {
        return parsed;
    }
    if (parsed.length <= ParseUrlStateIndex.SegmentsStart) {
        console.error('Error parsing compact URL state for Explore.');
        return errorResult;
    }
    var range = {
        from: parsed[ParseUrlStateIndex.RangeFrom],
        to: parsed[ParseUrlStateIndex.RangeTo],
    };
    var datasource = parsed[ParseUrlStateIndex.Datasource];
    var parsedSegments = parsed.slice(ParseUrlStateIndex.SegmentsStart);
    var queries = parsedSegments.filter(function (segment) { return !isSegment(segment, 'ui', 'originPanelId', 'mode'); });
    var originPanelId = parsedSegments.filter(function (segment) { return isSegment(segment, 'originPanelId'); })[0];
    return { datasource: datasource, queries: queries, range: range, originPanelId: originPanelId };
}
export function generateKey(index) {
    if (index === void 0) { index = 0; }
    return "Q-" + uuidv4() + "-" + index;
}
export function generateEmptyQuery(queries, index) {
    if (index === void 0) { index = 0; }
    return { refId: getNextRefIdChar(queries), key: generateKey(index) };
}
export var generateNewKeyAndAddRefIdIfMissing = function (target, queries, index) {
    if (index === void 0) { index = 0; }
    var key = generateKey(index);
    var refId = target.refId || getNextRefIdChar(queries);
    return __assign(__assign({}, target), { refId: refId, key: key });
};
/**
 * Ensure at least one target exists and that targets have the necessary keys
 */
export function ensureQueries(queries) {
    if (queries && typeof queries === 'object' && queries.length > 0) {
        var allQueries = [];
        for (var index = 0; index < queries.length; index++) {
            var query = queries[index];
            var key = generateKey(index);
            var refId = query.refId;
            if (!refId) {
                refId = getNextRefIdChar(allQueries);
            }
            allQueries.push(__assign(__assign({}, query), { refId: refId, key: key }));
        }
        return allQueries;
    }
    return [__assign({}, generateEmptyQuery(queries !== null && queries !== void 0 ? queries : []))];
}
/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key, context and datasource.
 * FIXME: While this is reasonable for practical use cases, a query without any propery might still be "non-empty"
 * in its own scope, for instance when there's no user input needed. This might be the case for an hypothetic datasource in
 * which query options are only set in its config and the query object itself, as generated from its query editor it's always "empty"
 */
var validKeys = ['refId', 'key', 'context', 'datasource'];
export function hasNonEmptyQuery(queries) {
    return (queries &&
        queries.some(function (query) {
            var keys = Object.keys(query)
                .filter(function (key) { return validKeys.indexOf(key) === -1; })
                .map(function (k) { return query[k]; })
                .filter(function (v) { return v; });
            return keys.length > 0;
        }));
}
/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory(history, datasourceId, queries) {
    var ts = Date.now();
    var updatedHistory = history;
    queries.forEach(function (query) {
        updatedHistory = __spreadArray([{ query: query, ts: ts }], __read(updatedHistory), false);
    });
    if (updatedHistory.length > MAX_HISTORY_ITEMS) {
        updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
    }
    // Combine all queries of a datasource type into one history
    var historyKey = "grafana.explore.history." + datasourceId;
    try {
        store.setObject(historyKey, updatedHistory);
        return updatedHistory;
    }
    catch (error) {
        console.error(error);
        return history;
    }
}
export function clearHistory(datasourceId) {
    var historyKey = "grafana.explore.history." + datasourceId;
    store.delete(historyKey);
}
export var getQueryKeys = function (queries, datasourceInstance) {
    var queryKeys = queries.reduce(function (newQueryKeys, query, index) {
        var primaryKey = datasourceInstance && datasourceInstance.name ? datasourceInstance.name : query.key;
        return newQueryKeys.concat(primaryKey + "-" + index);
    }, []);
    return queryKeys;
};
export var getTimeRange = function (timeZone, rawRange, fiscalYearStartMonth) {
    return {
        from: dateMath.parse(rawRange.from, false, timeZone, fiscalYearStartMonth),
        to: dateMath.parse(rawRange.to, true, timeZone, fiscalYearStartMonth),
        raw: rawRange,
    };
};
var parseRawTime = function (value) {
    if (value === null) {
        return null;
    }
    if (isDateTime(value)) {
        return value;
    }
    if (value.indexOf('now') !== -1) {
        return value;
    }
    if (value.length === 8) {
        return toUtc(value, 'YYYYMMDD');
    }
    if (value.length === 15) {
        return toUtc(value, 'YYYYMMDDTHHmmss');
    }
    // Backward compatibility
    if (value.length === 19) {
        return toUtc(value, 'YYYY-MM-DD HH:mm:ss');
    }
    // This should handle cases where value is an epoch time as string
    if (value.match(/^\d+$/)) {
        var epoch = parseInt(value, 10);
        return toUtc(epoch);
    }
    // This should handle ISO strings
    var time = toUtc(value);
    if (time.isValid()) {
        return time;
    }
    return null;
};
export var getTimeRangeFromUrl = function (range, timeZone, fiscalYearStartMonth) {
    var raw = {
        from: parseRawTime(range.from),
        to: parseRawTime(range.to),
    };
    return {
        from: dateMath.parse(raw.from, false, timeZone),
        to: dateMath.parse(raw.to, true, timeZone),
        raw: raw,
    };
};
export var getValueWithRefId = function (value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    if (value.refId) {
        return value;
    }
    var keys = Object.keys(value);
    for (var index = 0; index < keys.length; index++) {
        var key = keys[index];
        var refId = getValueWithRefId(value[key]);
        if (refId) {
            return refId;
        }
    }
    return undefined;
};
export var getRefIds = function (value) {
    if (!value) {
        return [];
    }
    if (typeof value !== 'object') {
        return [];
    }
    var keys = Object.keys(value);
    var refIds = [];
    for (var index = 0; index < keys.length; index++) {
        var key = keys[index];
        if (key === 'refId') {
            refIds.push(value[key]);
            continue;
        }
        refIds.push(getRefIds(value[key]));
    }
    return uniq(flatten(refIds));
};
export var refreshIntervalToSortOrder = function (refreshInterval) {
    return RefreshPicker.isLive(refreshInterval) ? LogsSortOrder.Ascending : LogsSortOrder.Descending;
};
export var convertToWebSocketUrl = function (url) {
    var protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    var backend = "" + protocol + window.location.host + config.appSubUrl;
    if (backend.endsWith('/')) {
        backend = backend.slice(0, -1);
    }
    return "" + backend + url;
};
export var stopQueryState = function (querySubscription) {
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
export var copyStringToClipboard = function (string) {
    var el = document.createElement('textarea');
    el.value = string;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
};
//# sourceMappingURL=explore.js.map