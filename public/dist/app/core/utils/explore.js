import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
// Services & Utils
import * as dateMath from 'app/core/utils/datemath';
import { renderUrl } from 'app/core/utils/url';
import kbn from 'app/core/utils/kbn';
import store from 'app/core/store';
import { parse as parseDate } from 'app/core/utils/datemath';
import { colors } from '@grafana/ui';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import TimeSeries from 'app/core/time_series2';
import { LogsDedupStrategy } from 'app/core/logs_model';
export var DEFAULT_RANGE = {
    from: 'now-6h',
    to: 'now',
};
export var DEFAULT_UI_STATE = {
    showingTable: true,
    showingGraph: true,
    showingLogs: true,
    dedupStrategy: LogsDedupStrategy.none,
};
var MAX_HISTORY_ITEMS = 100;
export var LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 *
 * @param panel Origin panel of the jump to Explore
 * @param panelTargets The origin panel's query targets
 * @param panelDatasource The origin panel's datasource
 * @param datasourceSrv Datasource service to query other datasources in case the panel datasource is mixed
 * @param timeSrv Time service to get the current dashboard range from
 */
export function getExploreUrl(panel, panelTargets, panelDatasource, datasourceSrv, timeSrv) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var e_1, _a, exploreDatasource, exploreTargets, url, mixedExploreDatasource_1, _b, _c, t, datasource, e_1_1, range, state, exploreState;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    exploreDatasource = panelDatasource;
                    exploreTargets = panelTargets;
                    if (!(panelDatasource.meta.id === 'mixed' && panelTargets)) return [3 /*break*/, 9];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    _b = tslib_1.__values(panel.targets), _c = _b.next();
                    _d.label = 2;
                case 2:
                    if (!!_c.done) return [3 /*break*/, 5];
                    t = _c.value;
                    return [4 /*yield*/, datasourceSrv.get(t.datasource)];
                case 3:
                    datasource = _d.sent();
                    if (datasource && datasource.meta.explore) {
                        mixedExploreDatasource_1 = datasource;
                        return [3 /*break*/, 5];
                    }
                    _d.label = 4;
                case 4:
                    _c = _b.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _d.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8:
                    // Add all its targets
                    if (mixedExploreDatasource_1) {
                        exploreDatasource = mixedExploreDatasource_1;
                        exploreTargets = panelTargets.filter(function (t) { return t.datasource === mixedExploreDatasource_1.name; });
                    }
                    _d.label = 9;
                case 9:
                    if (panelDatasource) {
                        range = timeSrv.timeRangeForUrl();
                        state = { range: range };
                        if (exploreDatasource.getExploreState) {
                            state = tslib_1.__assign({}, state, exploreDatasource.getExploreState(exploreTargets));
                        }
                        else {
                            state = tslib_1.__assign({}, state, { datasource: panelDatasource.name, queries: exploreTargets.map(function (t) { return (tslib_1.__assign({}, t, { datasource: panelDatasource.name })); }) });
                        }
                        exploreState = JSON.stringify(state);
                        url = renderUrl('/explore', { left: exploreState });
                    }
                    return [2 /*return*/, url];
            }
        });
    });
}
export function buildQueryTransaction(query, rowIndex, resultType, queryOptions, range, queryIntervals, scanning) {
    var interval = queryIntervals.interval, intervalMs = queryIntervals.intervalMs;
    var configuredQueries = [
        tslib_1.__assign({}, query, queryOptions),
    ];
    // Clone range for query request
    // const queryRange: RawTimeRange = { ...range };
    // const { from, to, raw } = this.timeSrv.timeRange();
    // Most datasource is using `panelId + query.refId` for cancellation logic.
    // Using `format` here because it relates to the view panel that the request is for.
    // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
    // Therefore panel id has to be unique.
    var panelId = queryOptions.format + "-" + query.key;
    var options = {
        interval: interval,
        intervalMs: intervalMs,
        panelId: panelId,
        targets: configuredQueries,
        range: {
            from: dateMath.parse(range.from, false),
            to: dateMath.parse(range.to, true),
            raw: range,
        },
        rangeRaw: range,
        scopedVars: {
            __interval: { text: interval, value: interval },
            __interval_ms: { text: intervalMs, value: intervalMs },
        },
    };
    return {
        options: options,
        query: query,
        resultType: resultType,
        rowIndex: rowIndex,
        scanning: scanning,
        id: generateKey(),
        done: false,
        latency: 0,
    };
}
export var clearQueryKeys = function (_a) {
    var key = _a.key, refId = _a.refId, rest = tslib_1.__rest(_a, ["key", "refId"]);
    return rest;
};
var isMetricSegment = function (segment) { return segment.hasOwnProperty('expr'); };
var isUISegment = function (segment) { return segment.hasOwnProperty('ui'); };
export function parseUrlState(initial) {
    var uiState = DEFAULT_UI_STATE;
    if (initial) {
        try {
            var parsed = JSON.parse(decodeURI(initial));
            if (Array.isArray(parsed)) {
                if (parsed.length <= 3) {
                    throw new Error('Error parsing compact URL state for Explore.');
                }
                var range = {
                    from: parsed[0],
                    to: parsed[1],
                };
                var datasource = parsed[2];
                var queries_1 = [];
                parsed.slice(3).forEach(function (segment) {
                    if (isMetricSegment(segment)) {
                        queries_1 = tslib_1.__spread(queries_1, [segment]);
                    }
                    if (isUISegment(segment)) {
                        uiState = {
                            showingGraph: segment.ui[0],
                            showingLogs: segment.ui[1],
                            showingTable: segment.ui[2],
                            dedupStrategy: segment.ui[3],
                        };
                    }
                });
                return { datasource: datasource, queries: queries_1, range: range, ui: uiState };
            }
            return parsed;
        }
        catch (e) {
            console.error(e);
        }
    }
    return { datasource: null, queries: [], range: DEFAULT_RANGE, ui: uiState };
}
export function serializeStateToUrlParam(urlState, compact) {
    if (compact) {
        return JSON.stringify(tslib_1.__spread([
            urlState.range.from,
            urlState.range.to,
            urlState.datasource
        ], urlState.queries, [
            {
                ui: [
                    !!urlState.ui.showingGraph,
                    !!urlState.ui.showingLogs,
                    !!urlState.ui.showingTable,
                    urlState.ui.dedupStrategy,
                ],
            },
        ]));
    }
    return JSON.stringify(urlState);
}
export function generateKey(index) {
    if (index === void 0) { index = 0; }
    return "Q-" + Date.now() + "-" + Math.random() + "-" + index;
}
export function generateRefId(index) {
    if (index === void 0) { index = 0; }
    return "" + (index + 1);
}
export function generateEmptyQuery(index) {
    if (index === void 0) { index = 0; }
    return { refId: generateRefId(index), key: generateKey(index) };
}
/**
 * Ensure at least one target exists and that targets have the necessary keys
 */
export function ensureQueries(queries) {
    if (queries && typeof queries === 'object' && queries.length > 0) {
        return queries.map(function (query, i) { return (tslib_1.__assign({}, query, generateEmptyQuery(i))); });
    }
    return [tslib_1.__assign({}, generateEmptyQuery())];
}
/**
 * A target is non-empty when it has keys (with non-empty values) other than refId and key.
 */
export function hasNonEmptyQuery(queries) {
    return (queries &&
        queries.some(function (query) {
            return Object.keys(query)
                .map(function (k) { return query[k]; })
                .filter(function (v) { return v; }).length > 2;
        }));
}
export function calculateResultsFromQueryTransactions(queryTransactions, datasource, graphInterval) {
    var graphResult = _.flatten(queryTransactions.filter(function (qt) { return qt.resultType === 'Graph' && qt.done && qt.result; }).map(function (qt) { return qt.result; }));
    var tableResult = mergeTablesIntoModel.apply(void 0, tslib_1.__spread([new TableModel()], queryTransactions
        .filter(function (qt) { return qt.resultType === 'Table' && qt.done && qt.result && qt.result.columns && qt.result.rows; })
        .map(function (qt) { return qt.result; })));
    var logsResult = datasource && datasource.mergeStreams
        ? datasource.mergeStreams(_.flatten(queryTransactions.filter(function (qt) { return qt.resultType === 'Logs' && qt.done && qt.result; }).map(function (qt) { return qt.result; })), graphInterval)
        : undefined;
    return {
        graphResult: graphResult,
        tableResult: tableResult,
        logsResult: logsResult,
    };
}
export function getIntervals(range, lowLimit, resolution) {
    if (!resolution) {
        return { interval: '1s', intervalMs: 1000 };
    }
    var absoluteRange = {
        from: parseDate(range.from, false),
        to: parseDate(range.to, true),
    };
    return kbn.calculateInterval(absoluteRange, resolution, lowLimit);
}
export var makeTimeSeriesList = function (dataList, transaction, allTransactions) {
    var e_2, _a;
    // Prevent multiple Graph transactions to have the same colors
    var colorIndexOffset = 0;
    try {
        for (var allTransactions_1 = tslib_1.__values(allTransactions), allTransactions_1_1 = allTransactions_1.next(); !allTransactions_1_1.done; allTransactions_1_1 = allTransactions_1.next()) {
            var other = allTransactions_1_1.value;
            // Only need to consider transactions that came before the current one
            if (other === transaction) {
                break;
            }
            // Count timeseries of previous query results
            if (other.resultType === 'Graph' && other.done) {
                colorIndexOffset += other.result.length;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (allTransactions_1_1 && !allTransactions_1_1.done && (_a = allTransactions_1.return)) _a.call(allTransactions_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return dataList.map(function (seriesData, index) {
        var datapoints = seriesData.datapoints || [];
        var alias = seriesData.target;
        var colorIndex = (colorIndexOffset + index) % colors.length;
        var color = colors[colorIndex];
        var series = new TimeSeries({
            datapoints: datapoints,
            alias: alias,
            color: color,
            unit: seriesData.unit,
        });
        return series;
    });
};
/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory(history, datasourceId, queries) {
    var ts = Date.now();
    queries.forEach(function (query) {
        history = tslib_1.__spread([{ query: query, ts: ts }], history);
    });
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }
    // Combine all queries of a datasource type into one history
    var historyKey = "grafana.explore.history." + datasourceId;
    store.setObject(historyKey, history);
    return history;
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
//# sourceMappingURL=explore.js.map