import { __awaiter, __generator, __read } from "tslib";
import { getDefaultTimeRange, LoadingState, } from '@grafana/data';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import store from '../../../core/store';
import { clearQueryKeys, lastUsedDatasourceKeyForOrgId, toGraphStyle, } from '../../../core/utils/explore';
import { toRawTimeRange } from '../utils/time';
export var DEFAULT_RANGE = {
    from: 'now-6h',
    to: 'now',
};
var GRAPH_STYLE_KEY = 'grafana.explore.style.graph';
export var storeGraphStyle = function (graphStyle) {
    store.set(GRAPH_STYLE_KEY, graphStyle);
};
var loadGraphStyle = function () {
    var data = store.get(GRAPH_STYLE_KEY);
    return toGraphStyle(data);
};
/**
 * Returns a fresh Explore area state
 */
export var makeExplorePaneState = function () { return ({
    containerWidth: 0,
    datasourceInstance: null,
    datasourceMissing: false,
    history: [],
    queries: [],
    initialized: false,
    range: {
        from: null,
        to: null,
        raw: DEFAULT_RANGE,
    },
    absoluteRange: {
        from: null,
        to: null,
    },
    scanning: false,
    loading: false,
    queryKeys: [],
    isLive: false,
    isPaused: false,
    queryResponse: createEmptyQueryResponse(),
    tableResult: null,
    graphResult: null,
    logsResult: null,
    eventBridge: null,
    cache: [],
    logsVolumeDataProvider: undefined,
    logsVolumeData: undefined,
    graphStyle: loadGraphStyle(),
}); };
export var createEmptyQueryResponse = function () { return ({
    state: LoadingState.NotStarted,
    series: [],
    timeRange: getDefaultTimeRange(),
}); };
export function loadAndInitDatasource(orgId, datasourceUid) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var instance, error_1, historyKey, history;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 4]);
                    return [4 /*yield*/, getDatasourceSrv().get(datasourceUid)];
                case 1:
                    instance = _b.sent();
                    return [3 /*break*/, 4];
                case 2:
                    error_1 = _b.sent();
                    return [4 /*yield*/, getDatasourceSrv().get()];
                case 3:
                    // Falling back to the default data source in case the provided data source was not found.
                    // It may happen if last used data source or the data source provided in the URL has been
                    // removed or it is not provisioned anymore.
                    instance = _b.sent();
                    return [3 /*break*/, 4];
                case 4:
                    if (instance.init) {
                        try {
                            instance.init();
                        }
                        catch (err) {
                            // TODO: should probably be handled better
                            console.error(err);
                        }
                    }
                    historyKey = "grafana.explore.history." + ((_a = instance.meta) === null || _a === void 0 ? void 0 : _a.id);
                    history = store.getObject(historyKey, []);
                    // Save last-used datasource
                    store.set(lastUsedDatasourceKeyForOrgId(orgId), instance.uid);
                    return [2 /*return*/, { history: history, instance: instance }];
            }
        });
    });
}
export function getUrlStateFromPaneState(pane) {
    var _a;
    return {
        // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
        // lets just fallback instead of crashing.
        datasource: ((_a = pane.datasourceInstance) === null || _a === void 0 ? void 0 : _a.name) || '',
        queries: pane.queries.map(clearQueryKeys),
        range: toRawTimeRange(pane.range),
    };
}
export function createCacheKey(absRange) {
    var params = {
        from: absRange.from,
        to: absRange.to,
    };
    var cacheKey = Object.entries(params)
        .map(function (_a) {
        var _b = __read(_a, 2), k = _b[0], v = _b[1];
        return encodeURIComponent(k) + "=" + encodeURIComponent(v.toString());
    })
        .join('&');
    return cacheKey;
}
export function getResultsFromCache(cache, absoluteRange) {
    var cacheKey = createCacheKey(absoluteRange);
    var cacheIdx = cache.findIndex(function (c) { return c.key === cacheKey; });
    var cacheValue = cacheIdx >= 0 ? cache[cacheIdx].value : undefined;
    return cacheValue;
}
//# sourceMappingURL=utils.js.map