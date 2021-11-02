import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
// Libraries
import { cloneDeep, isEmpty, map as lodashMap } from 'lodash';
import { lastValueFrom, merge, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import Prism from 'prismjs';
// Types
import { DataFrameView, DataSourceApi, dateMath, FieldCache, LoadingState, } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { addLabelToQuery } from 'app/plugins/datasource/prometheus/add_label_to_query';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import { lokiResultsToTableModel, lokiStreamResultToDataFrame, lokiStreamsToDataFrames, processRangeQueryResponse, } from './result_transformer';
import { addParsedLabelToQuery, queryHasPipeParser } from './query_utils';
import { LokiResultType, } from './types';
import { LiveStreams } from './live_streams';
import LanguageProvider from './language_provider';
import { serializeParams } from '../../../core/utils/fetch';
import syntax from './syntax';
import { DEFAULT_RESOLUTION } from './components/LokiOptionFields';
import { createLokiLogsVolumeProvider } from './dataProviders/logsVolumeProvider';
export var DEFAULT_MAX_LINES = 1000;
export var LOKI_ENDPOINT = '/loki/api/v1';
var NS_IN_MS = 1000000;
var RANGE_QUERY_ENDPOINT = LOKI_ENDPOINT + "/query_range";
var INSTANT_QUERY_ENDPOINT = LOKI_ENDPOINT + "/query";
var DEFAULT_QUERY_PARAMS = {
    direction: 'BACKWARD',
    limit: DEFAULT_MAX_LINES,
    query: '',
};
var LokiDatasource = /** @class */ (function (_super) {
    __extends(LokiDatasource, _super);
    function LokiDatasource(instanceSettings, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _a;
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.streams = new LiveStreams();
        _this.runInstantQuery = function (target, options, responseListLength) {
            if (responseListLength === void 0) { responseListLength = 1; }
            var timeNs = _this.getTime(options.range.to, true);
            var queryLimit = isMetricsQuery(target.expr) ? options.maxDataPoints : target.maxLines;
            var query = {
                query: target.expr,
                time: "" + (timeNs + (1e9 - (timeNs % 1e9))),
                limit: Math.min(queryLimit || Infinity, _this.maxLines),
            };
            /** Used only for results of metrics instant queries */
            var meta = {
                preferredVisualisationType: 'table',
            };
            return _this._request(INSTANT_QUERY_ENDPOINT, query).pipe(map(function (response) {
                if (response.data.data.resultType === LokiResultType.Stream) {
                    return {
                        data: response.data
                            ? lokiStreamsToDataFrames(response.data, target, query.limit, _this.instanceSettings.jsonData)
                            : [],
                        key: target.refId + "_instant",
                    };
                }
                return {
                    data: [lokiResultsToTableModel(response.data.data.result, responseListLength, target.refId, meta, true)],
                    key: target.refId + "_instant",
                };
            }), catchError(function (err) { return throwError(function () { return _this.processError(err, target); }); }));
        };
        /**
         * Attempts to send a query to /loki/api/v1/query_range
         */
        _this.runRangeQuery = function (target, options, responseListLength) {
            if (responseListLength === void 0) { responseListLength = 1; }
            // For metric query we use maxDataPoints from the request options which should be something like width of the
            // visualisation in pixels. In case of logs request we either use lines limit defined in the query target or
            // global limit defined for the data source which ever is lower.
            var maxDataPoints = isMetricsQuery(target.expr)
                ? // We fallback to maxLines here because maxDataPoints is defined as possibly undefined. Not sure that can
                    // actually happen both Dashboards and Explore should send some value here. If not maxLines does not make that
                    // much sense but nor any other arbitrary value.
                    options.maxDataPoints || _this.maxLines
                : // If user wants maxLines 0 we still fallback to data source limit. I think that makes sense as why would anyone
                    // want to do a query and not see any results?
                    target.maxLines || _this.maxLines;
            if (options.liveStreaming) {
                return _this.runLiveQuery(target, maxDataPoints);
            }
            var query = _this.createRangeQuery(target, options, maxDataPoints);
            return _this._request(RANGE_QUERY_ENDPOINT, query).pipe(catchError(function (err) { return throwError(function () { return _this.processError(err, target); }); }), switchMap(function (response) {
                return processRangeQueryResponse(response.data, target, query, responseListLength, maxDataPoints, _this.instanceSettings.jsonData, options.scopedVars, options.reverse);
            }));
        };
        /**
         * Runs live queries which in this case means creating a websocket and listening on it for new logs.
         * This returns a bit different dataFrame than runQueries as it returns single dataframe even if there are multiple
         * Loki streams, sets only common labels on dataframe.labels and has additional dataframe.fields.labels for unique
         * labels per row.
         */
        _this.runLiveQuery = function (target, maxDataPoints) {
            var liveTarget = _this.createLiveTarget(target, maxDataPoints);
            return _this.streams.getStream(liveTarget).pipe(map(function (data) { return ({
                data: data || [],
                key: "loki-" + liveTarget.refId,
                state: LoadingState.Streaming,
            }); }), catchError(function (err) {
                return throwError(function () { return "Live tailing was stopped due to following error: " + err.reason; });
            }));
        };
        _this.getLogRowContext = function (row, options) {
            var target = _this.prepareLogRowContextQueryTarget(row, (options && options.limit) || 10, (options && options.direction) || 'BACKWARD');
            var reverse = options && options.direction === 'FORWARD';
            return lastValueFrom(_this._request(RANGE_QUERY_ENDPOINT, target).pipe(catchError(function (err) {
                var error = {
                    message: 'Error during context query. Please check JS console logs.',
                    status: err.status,
                    statusText: err.statusText,
                };
                throw error;
            }), switchMap(function (res) {
                return of({
                    data: res.data
                        ? res.data.data.result.map(function (stream) { return lokiStreamResultToDataFrame(stream, reverse); })
                        : [],
                });
            })));
        };
        _this.prepareLogRowContextQueryTarget = function (row, limit, direction) {
            var labels = _this.languageProvider.getLabelKeys();
            var query = Object.keys(row.labels)
                .map(function (label) {
                if (labels.includes(label)) {
                    // escape backslashes in label as users can't escape them by themselves
                    return label + "=\"" + row.labels[label].replace(/\\/g, '\\\\') + "\"";
                }
                return '';
            })
                // Filter empty strings
                .filter(function (label) { return !!label; })
                .join(',');
            var contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer
            var commonTargetOptions = {
                limit: limit,
                query: "{" + query + "}",
                expr: "{" + query + "}",
                direction: direction,
            };
            var fieldCache = new FieldCache(row.dataFrame);
            var nsField = fieldCache.getFieldByName('tsNs');
            var nsTimestamp = nsField.values.get(row.rowIndex);
            if (direction === 'BACKWARD') {
                return __assign(__assign({}, commonTargetOptions), { 
                    // convert to ns, we loose some precision here but it is not that important at the far points of the context
                    start: row.timeEpochMs - contextTimeBuffer + '000000', end: nsTimestamp, direction: direction });
            }
            else {
                return __assign(__assign({}, commonTargetOptions), { 
                    // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
                    // and any other that were logged in the same ns but before the row. Right now these rows will be lost
                    // because the are before but came it he response that should return only rows after.
                    start: nsTimestamp, 
                    // convert to ns, we loose some precision here but it is not that important at the far points of the context
                    end: row.timeEpochMs + contextTimeBuffer + '000000' });
            }
        };
        _this.languageProvider = new LanguageProvider(_this);
        var settingsData = instanceSettings.jsonData || {};
        _this.maxLines = parseInt((_a = settingsData.maxLines) !== null && _a !== void 0 ? _a : '0', 10) || DEFAULT_MAX_LINES;
        return _this;
    }
    LokiDatasource.prototype._request = function (apiUrl, data, options) {
        var baseUrl = this.instanceSettings.url;
        var params = data ? serializeParams(data) : '';
        var url = "" + baseUrl + apiUrl + (params.length ? "?" + params : '');
        if (this.instanceSettings.withCredentials || this.instanceSettings.basicAuth) {
            options = __assign(__assign({}, options), { withCredentials: true });
            if (this.instanceSettings.basicAuth) {
                options.headers = __assign(__assign({}, options.headers), { Authorization: this.instanceSettings.basicAuth });
            }
        }
        var req = __assign(__assign({}, options), { url: url });
        return getBackendSrv().fetch(req);
    };
    LokiDatasource.prototype.getLogsVolumeDataProvider = function (request) {
        var isLogsVolumeAvailable = request.targets.some(function (target) { return target.expr && !isMetricsQuery(target.expr); });
        return isLogsVolumeAvailable ? createLokiLogsVolumeProvider(this, request) : undefined;
    };
    LokiDatasource.prototype.query = function (options) {
        var e_1, _a;
        var _this = this;
        var subQueries = [];
        var scopedVars = __assign(__assign({}, options.scopedVars), this.getRangeScopedVars(options.range));
        var filteredTargets = options.targets
            .filter(function (target) { return target.expr && !target.hide; })
            .map(function (target) {
            var expr = _this.addAdHocFilters(target.expr);
            return __assign(__assign({}, target), { expr: _this.templateSrv.replace(expr, scopedVars, _this.interpolateQueryExpr) });
        });
        try {
            for (var filteredTargets_1 = __values(filteredTargets), filteredTargets_1_1 = filteredTargets_1.next(); !filteredTargets_1_1.done; filteredTargets_1_1 = filteredTargets_1.next()) {
                var target = filteredTargets_1_1.value;
                if (target.instant) {
                    subQueries.push(this.runInstantQuery(target, options, filteredTargets.length));
                }
                else {
                    subQueries.push(this.runRangeQuery(target, options, filteredTargets.length));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (filteredTargets_1_1 && !filteredTargets_1_1.done && (_a = filteredTargets_1.return)) _a.call(filteredTargets_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // No valid targets, return the empty result to save a round trip.
        if (isEmpty(subQueries)) {
            return of({
                data: [],
                state: LoadingState.Done,
            });
        }
        return merge.apply(void 0, __spreadArray([], __read(subQueries), false));
    };
    LokiDatasource.prototype.createRangeQuery = function (target, options, limit) {
        var query = target.expr;
        var range = {};
        if (options.range) {
            var startNs = this.getTime(options.range.from, false);
            var endNs = this.getTime(options.range.to, true);
            var rangeMs = Math.ceil((endNs - startNs) / 1e6);
            var resolution = target.resolution || DEFAULT_RESOLUTION.value;
            var adjustedInterval = this.adjustInterval(options.intervalMs || 1000, resolution, rangeMs) / 1000;
            // We want to ceil to 3 decimal places
            var step = Math.ceil(adjustedInterval * 1000) / 1000;
            range = {
                start: startNs,
                end: endNs,
                step: step,
            };
        }
        return __assign(__assign(__assign({}, DEFAULT_QUERY_PARAMS), range), { query: query, limit: limit });
    };
    LokiDatasource.prototype.createLiveTarget = function (target, maxDataPoints) {
        var query = target.expr;
        var baseUrl = this.instanceSettings.url;
        var params = serializeParams({ query: query });
        return {
            query: query,
            url: convertToWebSocketUrl(baseUrl + "/loki/api/v1/tail?" + params),
            refId: target.refId,
            size: maxDataPoints,
        };
    };
    LokiDatasource.prototype.getRangeScopedVars = function (range) {
        if (range === void 0) { range = this.timeSrv.timeRange(); }
        var msRange = range.to.diff(range.from);
        var sRange = Math.round(msRange / 1000);
        return {
            __range_ms: { text: msRange, value: msRange },
            __range_s: { text: sRange, value: sRange },
            __range: { text: sRange + 's', value: sRange + 's' },
        };
    };
    LokiDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        var expandedQueries = queries;
        if (queries && queries.length) {
            expandedQueries = queries.map(function (query) { return (__assign(__assign({}, query), { datasource: _this.getRef(), expr: _this.templateSrv.replace(query.expr, scopedVars, _this.interpolateQueryExpr) })); });
        }
        return expandedQueries;
    };
    LokiDatasource.prototype.getQueryDisplayText = function (query) {
        return query.expr;
    };
    LokiDatasource.prototype.getTimeRangeParams = function () {
        var timeRange = this.timeSrv.timeRange();
        return { start: timeRange.from.valueOf() * NS_IN_MS, end: timeRange.to.valueOf() * NS_IN_MS };
    };
    LokiDatasource.prototype.importQueries = function (queries, originDataSource) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.languageProvider.importQueries(queries, originDataSource)];
            });
        });
    };
    LokiDatasource.prototype.metadataRequest = function (url, params) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this._request(url, params, { hideFromInspector: true }))];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.data.data || res.data.values || []];
                }
            });
        });
    };
    LokiDatasource.prototype.metricFindQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var interpolated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!query) {
                            return [2 /*return*/, Promise.resolve([])];
                        }
                        interpolated = this.templateSrv.replace(query, {}, this.interpolateQueryExpr);
                        return [4 /*yield*/, this.processMetricFindQuery(interpolated)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LokiDatasource.prototype.processMetricFindQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var labelNamesRegex, labelValuesRegex, labelNames, labelValues;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        labelNamesRegex = /^label_names\(\)\s*$/;
                        labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
                        labelNames = query.match(labelNamesRegex);
                        if (!labelNames) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.labelNamesQuery()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        labelValues = query.match(labelValuesRegex);
                        if (!labelValues) return [3 /*break*/, 6];
                        if (!labelValues[1]) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.labelValuesSeriesQuery(labelValues[1], labelValues[2])];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4: return [4 /*yield*/, this.labelValuesQuery(labelValues[2])];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6: return [2 /*return*/, Promise.resolve([])];
                }
            });
        });
    };
    LokiDatasource.prototype.labelNamesQuery = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, params, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = LOKI_ENDPOINT + "/label";
                        params = this.getTimeRangeParams();
                        return [4 /*yield*/, this.metadataRequest(url, params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.map(function (value) { return ({ text: value }); })];
                }
            });
        });
    };
    LokiDatasource.prototype.labelValuesQuery = function (label) {
        return __awaiter(this, void 0, void 0, function () {
            var params, url, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = this.getTimeRangeParams();
                        url = LOKI_ENDPOINT + "/label/" + label + "/values";
                        return [4 /*yield*/, this.metadataRequest(url, params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.map(function (value) { return ({ text: value }); })];
                }
            });
        });
    };
    LokiDatasource.prototype.labelValuesSeriesQuery = function (expr, label) {
        return __awaiter(this, void 0, void 0, function () {
            var timeParams, params, url, streams, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timeParams = this.getTimeRangeParams();
                        params = __assign(__assign({}, timeParams), { 'match[]': expr });
                        url = LOKI_ENDPOINT + "/series";
                        streams = new Set();
                        return [4 /*yield*/, this.metadataRequest(url, params)];
                    case 1:
                        result = _a.sent();
                        result.forEach(function (stream) {
                            if (stream[label]) {
                                streams.add({ text: stream[label] });
                            }
                        });
                        return [2 /*return*/, Array.from(streams)];
                }
            });
        });
    };
    // By implementing getTagKeys and getTagValues we add ad-hoc filtters functionality
    LokiDatasource.prototype.getTagKeys = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.labelNamesQuery()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LokiDatasource.prototype.getTagValues = function (options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.labelValuesQuery(options.key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LokiDatasource.prototype.interpolateQueryExpr = function (value, variable) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return lokiRegularEscape(value);
        }
        if (typeof value === 'string') {
            return lokiSpecialRegexEscape(value);
        }
        var escapedValues = lodashMap(value, lokiSpecialRegexEscape);
        return escapedValues.join('|');
    };
    LokiDatasource.prototype.modifyQuery = function (query, action) {
        var _a;
        var expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        switch (action.type) {
            case 'ADD_FILTER': {
                expression = this.addLabelToQuery(expression, action.key, action.value, '=');
                break;
            }
            case 'ADD_FILTER_OUT': {
                expression = this.addLabelToQuery(expression, action.key, action.value, '!=');
                break;
            }
            default:
                break;
        }
        return __assign(__assign({}, query), { expr: expression });
    };
    LokiDatasource.prototype.getTime = function (date, roundUp) {
        if (typeof date === 'string') {
            date = dateMath.parse(date, roundUp);
        }
        return Math.ceil(date.valueOf() * 1e6);
    };
    LokiDatasource.prototype.testDatasource = function () {
        // Consider only last 10 minutes otherwise request takes too long
        var startMs = Date.now() - 10 * 60 * 1000;
        var start = startMs + "000000"; // API expects nanoseconds
        return lastValueFrom(this._request(LOKI_ENDPOINT + "/label", { start: start }).pipe(map(function (res) {
            var _a, _b;
            var values = ((_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.data) || ((_b = res === null || res === void 0 ? void 0 : res.data) === null || _b === void 0 ? void 0 : _b.values) || [];
            var testResult = values.length > 0
                ? { status: 'success', message: 'Data source connected and labels found.' }
                : {
                    status: 'error',
                    message: 'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
                };
            return testResult;
        }), catchError(function (err) {
            var message = 'Loki: ';
            if (err.statusText) {
                message += err.statusText;
            }
            else {
                message += 'Cannot connect to Loki';
            }
            if (err.status) {
                message += ". " + err.status;
            }
            if (err.data && err.data.message) {
                message += ". " + err.data.message;
            }
            else if (err.data) {
                message += ". " + err.data;
            }
            return of({ status: 'error', message: message });
        })));
    };
    LokiDatasource.prototype.annotationQuery = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, expr, maxLines, instant, stepInterval, _b, tagKeys, _c, titleFormat, _d, textFormat, interpolatedExpr, query, data, _e, annotations, splitKeys, _loop_1, data_1, data_1_1, frame;
            var e_2, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _a = options.annotation, expr = _a.expr, maxLines = _a.maxLines, instant = _a.instant, stepInterval = _a.stepInterval, _b = _a.tagKeys, tagKeys = _b === void 0 ? '' : _b, _c = _a.titleFormat, titleFormat = _c === void 0 ? '' : _c, _d = _a.textFormat, textFormat = _d === void 0 ? '' : _d;
                        if (!expr) {
                            return [2 /*return*/, []];
                        }
                        interpolatedExpr = this.templateSrv.replace(expr, {}, this.interpolateQueryExpr);
                        query = {
                            refId: "annotation-" + options.annotation.name,
                            expr: interpolatedExpr,
                            maxLines: maxLines,
                            instant: instant,
                            stepInterval: stepInterval,
                        };
                        if (!instant) return [3 /*break*/, 2];
                        return [4 /*yield*/, lastValueFrom(this.runInstantQuery(query, options))];
                    case 1:
                        _e = _g.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, lastValueFrom(this.runRangeQuery(query, options))];
                    case 3:
                        _e = _g.sent();
                        _g.label = 4;
                    case 4:
                        data = (_e).data;
                        annotations = [];
                        splitKeys = tagKeys.split(',').filter(function (v) { return v !== ''; });
                        _loop_1 = function (frame) {
                            var e_3, _h, e_4, _j;
                            var labels = {};
                            try {
                                for (var _k = (e_3 = void 0, __values(frame.fields)), _l = _k.next(); !_l.done; _l = _k.next()) {
                                    var field = _l.value;
                                    if (field.labels) {
                                        try {
                                            for (var _m = (e_4 = void 0, __values(Object.entries(field.labels))), _o = _m.next(); !_o.done; _o = _m.next()) {
                                                var _p = __read(_o.value, 2), key = _p[0], value = _p[1];
                                                labels[key] = String(value).trim();
                                            }
                                        }
                                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                                        finally {
                                            try {
                                                if (_o && !_o.done && (_j = _m.return)) _j.call(_m);
                                            }
                                            finally { if (e_4) throw e_4.error; }
                                        }
                                    }
                                }
                            }
                            catch (e_3_1) { e_3 = { error: e_3_1 }; }
                            finally {
                                try {
                                    if (_l && !_l.done && (_h = _k.return)) _h.call(_k);
                                }
                                finally { if (e_3) throw e_3.error; }
                            }
                            var tags = __spreadArray([], __read(new Set(Object.entries(labels).reduce(function (acc, _a) {
                                var _b = __read(_a, 2), key = _b[0], val = _b[1];
                                if (val === '') {
                                    return acc;
                                }
                                if (splitKeys.length && !splitKeys.includes(key)) {
                                    return acc;
                                }
                                acc.push.apply(acc, [val]);
                                return acc;
                            }, []))), false);
                            var view = new DataFrameView(frame);
                            view.forEach(function (row) {
                                annotations.push({
                                    time: new Date(row.ts).valueOf(),
                                    title: renderTemplate(titleFormat, labels),
                                    text: renderTemplate(textFormat, labels) || row.line,
                                    tags: tags,
                                });
                            });
                        };
                        try {
                            for (data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                                frame = data_1_1.value;
                                _loop_1(frame);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (data_1_1 && !data_1_1.done && (_f = data_1.return)) _f.call(data_1);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                        return [2 /*return*/, annotations];
                }
            });
        });
    };
    LokiDatasource.prototype.showContextToggle = function (row) {
        return (row && row.searchWords && row.searchWords.length > 0) === true;
    };
    LokiDatasource.prototype.processError = function (err, target) {
        var error = cloneDeep(err);
        if (err.data.message.includes('escape') && target.expr.includes('\\')) {
            error.data.message = "Error: " + err.data.message + ". Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.";
        }
        return error;
    };
    LokiDatasource.prototype.adjustInterval = function (dynamicInterval, resolution, range) {
        // Loki will drop queries that might return more than 11000 data points.
        // Calibrate interval if it is too small.
        var safeInterval = range / 11000;
        if (safeInterval > 1) {
            safeInterval = Math.ceil(safeInterval);
        }
        var adjustedInterval = Math.max(resolution * dynamicInterval, safeInterval);
        return adjustedInterval;
    };
    LokiDatasource.prototype.addAdHocFilters = function (queryExpr) {
        var _this = this;
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        var expr = queryExpr;
        expr = adhocFilters.reduce(function (acc, filter) {
            var key = filter.key, operator = filter.operator;
            var value = filter.value;
            if (operator === '=~' || operator === '!~') {
                value = lokiRegularEscape(value);
            }
            return _this.addLabelToQuery(acc, key, value, operator);
        }, expr);
        return expr;
    };
    LokiDatasource.prototype.addLabelToQuery = function (queryExpr, key, value, operator) {
        if (queryHasPipeParser(queryExpr) && !isMetricsQuery(queryExpr)) {
            // If query has parser, we treat all labels as parsed and use | key="value" syntax
            return addParsedLabelToQuery(queryExpr, key, value, operator);
        }
        else {
            return addLabelToQuery(queryExpr, key, value, operator, true);
        }
    };
    return LokiDatasource;
}(DataSourceApi));
export { LokiDatasource };
export function renderTemplate(aliasPattern, aliasData) {
    var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, function (_match, g1) {
        if (aliasData[g1]) {
            return aliasData[g1];
        }
        return '';
    });
}
export function lokiRegularEscape(value) {
    if (typeof value === 'string') {
        return value.replace(/'/g, "\\\\'");
    }
    return value;
}
export function lokiSpecialRegexEscape(value) {
    if (typeof value === 'string') {
        return lokiRegularEscape(value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]+?.()|]/g, '\\\\$&'));
    }
    return value;
}
/**
 * Checks if the query expression uses function and so should return a time series instead of logs.
 * Sometimes important to know that before we actually do the query.
 */
export function isMetricsQuery(query) {
    var tokens = Prism.tokenize(query, syntax);
    return tokens.some(function (t) {
        // Not sure in which cases it can be string maybe if nothing matched which means it should not be a function
        return typeof t !== 'string' && t.type === 'function';
    });
}
export default LokiDatasource;
//# sourceMappingURL=datasource.js.map