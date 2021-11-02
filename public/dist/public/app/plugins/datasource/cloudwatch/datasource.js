import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import angular from 'angular';
import { find, isEmpty, isString, set } from 'lodash';
import { from, lastValueFrom, merge, Observable, of, throwError, zip } from 'rxjs';
import { catchError, concatMap, finalize, map, mergeMap, repeat, scan, share, takeWhile, tap } from 'rxjs/operators';
import { DataSourceWithBackend, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { DataQueryErrorType, dateMath, LoadingState, rangeUtil, toLegacyResponseData, } from '@grafana/data';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { AppNotificationTimeout } from 'app/types';
import { store } from 'app/store/store';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ThrottlingErrorMessage } from './components/ThrottlingErrorMessage';
import memoizedDebounce from './memoizedDebounce';
import { CloudWatchLogsQueryStatus, isCloudWatchLogsQuery, } from './types';
import { CloudWatchLanguageProvider } from './language_provider';
import { increasingInterval } from './utils/rxjs/increasingInterval';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';
import { addDataLinksToLogsResponse } from './utils/datalinks';
var DS_QUERY_ENDPOINT = '/api/ds/query';
// Constants also defined in tsdb/cloudwatch/cloudwatch.go
var LOG_IDENTIFIER_INTERNAL = '__log__grafana_internal__';
var LOGSTREAM_IDENTIFIER_INTERNAL = '__logstream__grafana_internal__';
var displayAlert = function (datasourceName, region) {
    return store.dispatch(notifyApp(createErrorNotification("CloudWatch request limit reached in " + region + " for data source " + datasourceName, '', React.createElement(ThrottlingErrorMessage, { region: region }, null))));
};
var displayCustomError = function (title, message) {
    return store.dispatch(notifyApp(createErrorNotification(title, message)));
};
export var MAX_ATTEMPTS = 5;
var CloudWatchDatasource = /** @class */ (function (_super) {
    __extends(CloudWatchDatasource, _super);
    function CloudWatchDatasource(instanceSettings, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.type = 'cloudwatch';
        _this.standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];
        _this.debouncedAlert = memoizedDebounce(displayAlert, AppNotificationTimeout.Error);
        _this.debouncedCustomAlert = memoizedDebounce(displayCustomError, AppNotificationTimeout.Error);
        _this.logQueries = {};
        /**
         * Handle log query. The log query works by starting the query on the CloudWatch and then periodically polling for
         * results.
         * @param logQueries
         * @param options
         */
        _this.handleLogQueries = function (logQueries, options) {
            var validLogQueries = logQueries.filter(function (item) { var _a; return (_a = item.logGroupNames) === null || _a === void 0 ? void 0 : _a.length; });
            if (logQueries.length > validLogQueries.length) {
                return of({ data: [], error: { message: 'Log group is required' } });
            }
            // No valid targets, return the empty result to save a round trip.
            if (isEmpty(validLogQueries)) {
                return of({ data: [], state: LoadingState.Done });
            }
            var queryParams = logQueries.map(function (target) { return ({
                queryString: target.expression,
                refId: target.refId,
                logGroupNames: target.logGroupNames,
                region: _this.replace(_this.getActualRegion(target.region), options.scopedVars, true, 'region'),
            }); });
            // This first starts the query which returns queryId which can be used to retrieve results.
            return _this.makeLogActionRequest('StartQuery', queryParams, {
                makeReplacements: true,
                scopedVars: options.scopedVars,
                skipCache: true,
            }).pipe(mergeMap(function (dataFrames) {
                // This queries for the results
                return _this.logsQuery(dataFrames.map(function (dataFrame) {
                    var _a, _b, _c;
                    return ({
                        queryId: dataFrame.fields[0].values.get(0),
                        region: (_c = (_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b['Region']) !== null && _c !== void 0 ? _c : 'default',
                        refId: dataFrame.refId,
                        statsGroups: logQueries.find(function (target) { return target.refId === dataFrame.refId; })
                            .statsGroups,
                    });
                }));
            }), mergeMap(function (dataQueryResponse) {
                return from((function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, addDataLinksToLogsResponse(dataQueryResponse, options, this.timeSrv.timeRange(), this.replace.bind(this), this.getActualRegion.bind(this), this.tracingDataSourceUid)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/, dataQueryResponse];
                        }
                    });
                }); })());
            }));
        };
        _this.handleMetricQueries = function (metricQueries, options) {
            var _a, _b;
            var validMetricsQueries = metricQueries
                .filter(function (item) { var _a; return (!!item.region && !!item.namespace && !!item.metricName && !!item.statistic) || ((_a = item.expression) === null || _a === void 0 ? void 0 : _a.length) > 0; })
                .map(function (item) {
                item.region = _this.replace(_this.getActualRegion(item.region), options.scopedVars, true, 'region');
                item.namespace = _this.replace(item.namespace, options.scopedVars, true, 'namespace');
                item.metricName = _this.replace(item.metricName, options.scopedVars, true, 'metric name');
                item.dimensions = _this.convertDimensionFormat(item.dimensions, options.scopedVars);
                item.statistic = _this.templateSrv.replace(item.statistic, options.scopedVars);
                item.period = String(_this.getPeriod(item, options)); // use string format for period in graph query, and alerting
                item.id = _this.templateSrv.replace(item.id, options.scopedVars);
                item.expression = _this.templateSrv.replace(item.expression, options.scopedVars);
                return __assign({ intervalMs: options.intervalMs, maxDataPoints: options.maxDataPoints, datasourceId: _this.id, type: 'timeSeriesQuery' }, item);
            });
            // No valid targets, return the empty result to save a round trip.
            if (isEmpty(validMetricsQueries)) {
                return of({ data: [] });
            }
            var request = {
                from: (_a = options === null || options === void 0 ? void 0 : options.range) === null || _a === void 0 ? void 0 : _a.from.valueOf().toString(),
                to: (_b = options === null || options === void 0 ? void 0 : options.range) === null || _b === void 0 ? void 0 : _b.to.valueOf().toString(),
                queries: validMetricsQueries,
            };
            return _this.performTimeSeriesQuery(request, options.range);
        };
        _this.getLogRowContext = function (row, _a) {
            var _b = _a === void 0 ? {} : _a, _c = _b.limit, limit = _c === void 0 ? 10 : _c, _d = _b.direction, direction = _d === void 0 ? 'BACKWARD' : _d;
            return __awaiter(_this, void 0, void 0, function () {
                var logStreamField, logField, _e, _f, field, requestParams, dataFrames;
                var e_1, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            logStreamField = null;
                            logField = null;
                            try {
                                for (_e = __values(row.dataFrame.fields), _f = _e.next(); !_f.done; _f = _e.next()) {
                                    field = _f.value;
                                    if (field.name === LOGSTREAM_IDENTIFIER_INTERNAL) {
                                        logStreamField = field;
                                        if (logField !== null) {
                                            break;
                                        }
                                    }
                                    else if (field.name === LOG_IDENTIFIER_INTERNAL) {
                                        logField = field;
                                        if (logStreamField !== null) {
                                            break;
                                        }
                                    }
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (_f && !_f.done && (_g = _e.return)) _g.call(_e);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                            requestParams = {
                                limit: limit,
                                startFromHead: direction !== 'BACKWARD',
                                logGroupName: parseLogGroupName(logField.values.get(row.rowIndex)),
                                logStreamName: logStreamField.values.get(row.rowIndex),
                            };
                            if (direction === 'BACKWARD') {
                                requestParams.endTime = row.timeEpochMs;
                            }
                            else {
                                requestParams.startTime = row.timeEpochMs;
                            }
                            return [4 /*yield*/, lastValueFrom(this.makeLogActionRequest('GetLogEvents', [requestParams]))];
                        case 1:
                            dataFrames = _h.sent();
                            return [2 /*return*/, {
                                    data: dataFrames,
                                }];
                    }
                });
            });
        };
        _this.getTargetsByQueryMode = function (targets) {
            var logQueries = [];
            var metricsQueries = [];
            targets.forEach(function (query) {
                var _a;
                var mode = (_a = query.queryMode) !== null && _a !== void 0 ? _a : 'Metrics';
                if (mode === 'Logs') {
                    logQueries.push(query);
                }
                else {
                    metricsQueries.push(query);
                }
            });
            return {
                logQueries: logQueries,
                metricsQueries: metricsQueries,
            };
        };
        _this.proxyUrl = instanceSettings.url;
        _this.defaultRegion = instanceSettings.jsonData.defaultRegion;
        _this.datasourceName = instanceSettings.name;
        _this.languageProvider = new CloudWatchLanguageProvider(_this);
        _this.tracingDataSourceUid = instanceSettings.jsonData.tracingDatasourceUid;
        return _this;
    }
    CloudWatchDatasource.prototype.query = function (options) {
        options = angular.copy(options);
        var queries = options.targets.filter(function (item) { return item.id !== '' || item.hide !== true; });
        var _a = this.getTargetsByQueryMode(queries), logQueries = _a.logQueries, metricsQueries = _a.metricsQueries;
        var dataQueryResponses = [];
        if (logQueries.length > 0) {
            dataQueryResponses.push(this.handleLogQueries(logQueries, options));
        }
        if (metricsQueries.length > 0) {
            dataQueryResponses.push(this.handleMetricQueries(metricsQueries, options));
        }
        // No valid targets, return the empty result to save a round trip.
        if (isEmpty(dataQueryResponses)) {
            return of({
                data: [],
                state: LoadingState.Done,
            });
        }
        return merge.apply(void 0, __spreadArray([], __read(dataQueryResponses), false));
    };
    /**
     * Checks progress and polls data of a started logs query with some retry logic.
     * @param queryParams
     */
    CloudWatchDatasource.prototype.logsQuery = function (queryParams) {
        var _this = this;
        this.logQueries = {};
        queryParams.forEach(function (param) {
            var _a, _b, _c;
            _this.logQueries[param.refId] = {
                id: param.queryId,
                region: param.region,
                statsQuery: (_c = ((_b = (_a = param.statsGroups) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0) !== null && _c !== void 0 ? _c : false,
            };
        });
        var dataFrames = increasingInterval({ startPeriod: 100, endPeriod: 1000, step: 300 }).pipe(concatMap(function (_) { return _this.makeLogActionRequest('GetQueryResults', queryParams, { skipCache: true }); }), repeat(), share());
        var consecutiveFailedAttempts = dataFrames.pipe(scan(function (_a, frames) {
            var e_2, _b;
            var _c, _d, _e, _f;
            var failures = _a.failures, prevRecordsMatched = _a.prevRecordsMatched;
            failures++;
            try {
                for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
                    var frame = frames_1_1.value;
                    var recordsMatched = (_e = (_d = (_c = frame.meta) === null || _c === void 0 ? void 0 : _c.stats) === null || _d === void 0 ? void 0 : _d.find(function (stat) { return stat.displayName === 'Records scanned'; })) === null || _e === void 0 ? void 0 : _e.value;
                    if (recordsMatched > ((_f = prevRecordsMatched[frame.refId]) !== null && _f !== void 0 ? _f : 0)) {
                        failures = 0;
                    }
                    prevRecordsMatched[frame.refId] = recordsMatched;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (frames_1_1 && !frames_1_1.done && (_b = frames_1.return)) _b.call(frames_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return { failures: failures, prevRecordsMatched: prevRecordsMatched };
        }, { failures: 0, prevRecordsMatched: {} }), map(function (_a) {
            var failures = _a.failures;
            return failures;
        }), share());
        var queryResponse = zip(dataFrames, consecutiveFailedAttempts).pipe(tap(function (_a) {
            var e_3, _b;
            var _c, _d;
            var _e = __read(_a, 1), dataFrames = _e[0];
            try {
                for (var dataFrames_1 = __values(dataFrames), dataFrames_1_1 = dataFrames_1.next(); !dataFrames_1_1.done; dataFrames_1_1 = dataFrames_1.next()) {
                    var frame = dataFrames_1_1.value;
                    if ([
                        CloudWatchLogsQueryStatus.Complete,
                        CloudWatchLogsQueryStatus.Cancelled,
                        CloudWatchLogsQueryStatus.Failed,
                    ].includes((_d = (_c = frame.meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d['Status']) &&
                        _this.logQueries.hasOwnProperty(frame.refId)) {
                        delete _this.logQueries[frame.refId];
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (dataFrames_1_1 && !dataFrames_1_1.done && (_b = dataFrames_1.return)) _b.call(dataFrames_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }), map(function (_a) {
            var e_4, _b;
            var _c = __read(_a, 2), dataFrames = _c[0], failedAttempts = _c[1];
            if (failedAttempts >= MAX_ATTEMPTS) {
                try {
                    for (var dataFrames_2 = __values(dataFrames), dataFrames_2_1 = dataFrames_2.next(); !dataFrames_2_1.done; dataFrames_2_1 = dataFrames_2.next()) {
                        var frame = dataFrames_2_1.value;
                        set(frame, 'meta.custom.Status', CloudWatchLogsQueryStatus.Cancelled);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (dataFrames_2_1 && !dataFrames_2_1.done && (_b = dataFrames_2.return)) _b.call(dataFrames_2);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
            return {
                data: dataFrames,
                key: 'test-key',
                state: dataFrames.every(function (dataFrame) {
                    var _a, _b;
                    return [
                        CloudWatchLogsQueryStatus.Complete,
                        CloudWatchLogsQueryStatus.Cancelled,
                        CloudWatchLogsQueryStatus.Failed,
                    ].includes((_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b['Status']);
                })
                    ? LoadingState.Done
                    : LoadingState.Loading,
                error: failedAttempts >= MAX_ATTEMPTS
                    ? {
                        message: "error: query timed out after " + MAX_ATTEMPTS + " attempts",
                        type: DataQueryErrorType.Timeout,
                    }
                    : undefined,
            };
        }), takeWhile(function (_a) {
            var state = _a.state;
            return state !== LoadingState.Error && state !== LoadingState.Done;
        }, true));
        return withTeardown(queryResponse, function () { return _this.stopQueries(); });
    };
    CloudWatchDatasource.prototype.stopQueries = function () {
        var _this = this;
        if (Object.keys(this.logQueries).length > 0) {
            this.makeLogActionRequest('StopQuery', Object.values(this.logQueries).map(function (logQuery) { return ({ queryId: logQuery.id, region: logQuery.region }); }), {
                makeReplacements: false,
                skipCache: true,
            }).pipe(finalize(function () {
                _this.logQueries = {};
            }));
        }
    };
    CloudWatchDatasource.prototype.describeLogGroups = function (params) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var dataFrames, logGroupNames;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this.makeLogActionRequest('DescribeLogGroups', [params]))];
                    case 1:
                        dataFrames = _d.sent();
                        logGroupNames = (_c = (_b = (_a = dataFrames[0]) === null || _a === void 0 ? void 0 : _a.fields[0]) === null || _b === void 0 ? void 0 : _b.values.toArray()) !== null && _c !== void 0 ? _c : [];
                        return [2 /*return*/, logGroupNames];
                }
            });
        });
    };
    CloudWatchDatasource.prototype.getLogGroupFields = function (params) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var dataFrames, fieldNames, fieldPercentages, getLogGroupFieldsResponse;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this.makeLogActionRequest('GetLogGroupFields', [params]))];
                    case 1:
                        dataFrames = _b.sent();
                        fieldNames = dataFrames[0].fields[0].values.toArray();
                        fieldPercentages = dataFrames[0].fields[1].values.toArray();
                        getLogGroupFieldsResponse = {
                            logGroupFields: (_a = fieldNames.map(function (val, i) { return ({ name: val, percent: fieldPercentages[i] }); })) !== null && _a !== void 0 ? _a : [],
                        };
                        return [2 /*return*/, getLogGroupFieldsResponse];
                }
            });
        });
    };
    CloudWatchDatasource.prototype.getVariables = function () {
        return this.templateSrv.getVariables().map(function (v) { return "$" + v.name; });
    };
    CloudWatchDatasource.prototype.getPeriod = function (target, options) {
        var period = this.templateSrv.replace(target.period, options.scopedVars);
        if (period && period.toLowerCase() !== 'auto') {
            if (/^\d+$/.test(period)) {
                period = parseInt(period, 10);
            }
            else {
                period = rangeUtil.intervalToSeconds(period);
            }
            if (period < 1) {
                period = 1;
            }
        }
        return period || '';
    };
    CloudWatchDatasource.prototype.performTimeSeriesQuery = function (request, _a) {
        var _this = this;
        var from = _a.from, to = _a.to;
        return this.awsRequest(DS_QUERY_ENDPOINT, request).pipe(map(function (res) {
            var dataframes = toDataQueryResponse({ data: res }).data;
            if (!dataframes || dataframes.length <= 0) {
                return { data: [] };
            }
            return {
                data: dataframes,
                error: Object.values(res.results).reduce(function (acc, curr) { return (curr.error ? { message: curr.error } : acc); }, null),
            };
        }), catchError(function (err) {
            var isFrameError = err.data.results;
            // Error is not frame specific
            if (!isFrameError && err.data && err.data.message === 'Metric request error' && err.data.error) {
                err.message = err.data.error;
                return throwError(function () { return err; });
            }
            // The error is either for a specific frame or for all the frames
            var results = Object.values(err.data.results);
            var firstErrorResult = results.find(function (r) { return r.error; });
            if (firstErrorResult) {
                err.message = firstErrorResult.error;
            }
            if (results.some(function (r) { return r.error && /^Throttling:.*/.test(r.error); })) {
                var failedRedIds_1 = Object.keys(err.data.results);
                var regionsAffected = Object.values(request.queries).reduce(function (res, _a) {
                    var refId = _a.refId, region = _a.region;
                    return (refId && !failedRedIds_1.includes(refId)) || res.includes(region) ? res : __spreadArray(__spreadArray([], __read(res), false), [region], false);
                }, []);
                regionsAffected.forEach(function (region) { return _this.debouncedAlert(_this.datasourceName, _this.getActualRegion(region)); });
            }
            return throwError(function () { return err; });
        }));
    };
    CloudWatchDatasource.prototype.transformSuggestDataFromDataframes = function (suggestData) {
        var frames = toDataQueryResponse({ data: suggestData }).data;
        var table = toLegacyResponseData(frames[0]);
        return table.rows.map(function (_a) {
            var _b = __read(_a, 2), text = _b[0], value = _b[1];
            return ({
                text: text,
                value: value,
                label: value,
            });
        });
    };
    CloudWatchDatasource.prototype.doMetricQueryRequest = function (subtype, parameters) {
        var _this = this;
        var range = this.timeSrv.timeRange();
        return lastValueFrom(this.awsRequest(DS_QUERY_ENDPOINT, {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries: [
                __assign({ refId: 'metricFindQuery', intervalMs: 1, maxDataPoints: 1, datasourceId: this.id, type: 'metricFindQuery', subtype: subtype }, parameters),
            ],
        }).pipe(map(function (r) {
            return _this.transformSuggestDataFromDataframes(r);
        })));
    };
    CloudWatchDatasource.prototype.makeLogActionRequest = function (subtype, queryParams, options) {
        var _this = this;
        if (options === void 0) { options = {
            makeReplacements: true,
            skipCache: false,
        }; }
        var range = this.timeSrv.timeRange();
        var requestParams = {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries: queryParams.map(function (param) { return (__assign({ refId: 'A', intervalMs: 1, maxDataPoints: 1, datasourceId: _this.id, type: 'logAction', subtype: subtype }, param)); }),
        };
        if (options.makeReplacements) {
            requestParams.queries.forEach(function (query) {
                var e_5, _a;
                var fieldsToReplace = ['queryString', 'logGroupNames', 'logGroupName', 'logGroupNamePrefix'];
                var _loop_1 = function (fieldName) {
                    if (query.hasOwnProperty(fieldName)) {
                        if (Array.isArray(query[fieldName])) {
                            query[fieldName] = query[fieldName].map(function (val) {
                                return _this.replace(val, options.scopedVars, true, fieldName);
                            });
                        }
                        else {
                            query[fieldName] = _this.replace(query[fieldName], options.scopedVars, true, fieldName);
                        }
                    }
                };
                try {
                    for (var fieldsToReplace_1 = __values(fieldsToReplace), fieldsToReplace_1_1 = fieldsToReplace_1.next(); !fieldsToReplace_1_1.done; fieldsToReplace_1_1 = fieldsToReplace_1.next()) {
                        var fieldName = fieldsToReplace_1_1.value;
                        _loop_1(fieldName);
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (fieldsToReplace_1_1 && !fieldsToReplace_1_1.done && (_a = fieldsToReplace_1.return)) _a.call(fieldsToReplace_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                query.region = _this.replace(query.region, options.scopedVars, true, 'region');
                query.region = _this.getActualRegion(query.region);
            });
        }
        var resultsToDataFrames = function (val) { return toDataQueryResponse(val).data || []; };
        var headers = {};
        if (options.skipCache) {
            headers = {
                'X-Cache-Skip': true,
            };
        }
        return this.awsRequest(DS_QUERY_ENDPOINT, requestParams, headers).pipe(map(function (response) { return resultsToDataFrames({ data: response }); }), catchError(function (err) {
            var _a, _b;
            if ((_a = err.data) === null || _a === void 0 ? void 0 : _a.error) {
                throw err.data.error;
            }
            else if ((_b = err.data) === null || _b === void 0 ? void 0 : _b.message) {
                // In PROD we do not supply .error
                throw err.data.message;
            }
            throw err;
        }));
    };
    CloudWatchDatasource.prototype.getRegions = function () {
        return this.doMetricQueryRequest('regions', null).then(function (regions) { return __spreadArray([
            { label: 'default', value: 'default', text: 'default' }
        ], __read(regions), false); });
    };
    CloudWatchDatasource.prototype.getNamespaces = function () {
        return this.doMetricQueryRequest('namespaces', null);
    };
    CloudWatchDatasource.prototype.getMetrics = function (namespace, region) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!namespace) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, this.doMetricQueryRequest('metrics', {
                        region: this.templateSrv.replace(this.getActualRegion(region)),
                        namespace: this.templateSrv.replace(namespace),
                    })];
            });
        });
    };
    CloudWatchDatasource.prototype.getDimensionKeys = function (namespace, region) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!namespace) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, this.doMetricQueryRequest('dimension_keys', {
                        region: this.templateSrv.replace(this.getActualRegion(region)),
                        namespace: this.templateSrv.replace(namespace),
                    })];
            });
        });
    };
    CloudWatchDatasource.prototype.getDimensionValues = function (region, namespace, metricName, dimensionKey, filterDimensions) {
        return __awaiter(this, void 0, void 0, function () {
            var values;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!namespace || !metricName) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.doMetricQueryRequest('dimension_values', {
                                region: this.templateSrv.replace(this.getActualRegion(region)),
                                namespace: this.templateSrv.replace(namespace),
                                metricName: this.templateSrv.replace(metricName.trim()),
                                dimensionKey: this.templateSrv.replace(dimensionKey),
                                dimensions: this.convertDimensionFormat(filterDimensions, {}),
                            })];
                    case 1:
                        values = _a.sent();
                        return [2 /*return*/, values];
                }
            });
        });
    };
    CloudWatchDatasource.prototype.getEbsVolumeIds = function (region, instanceId) {
        return this.doMetricQueryRequest('ebs_volume_ids', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            instanceId: this.templateSrv.replace(instanceId),
        });
    };
    CloudWatchDatasource.prototype.getEc2InstanceAttribute = function (region, attributeName, filters) {
        return this.doMetricQueryRequest('ec2_instance_attribute', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            attributeName: this.templateSrv.replace(attributeName),
            filters: filters,
        });
    };
    CloudWatchDatasource.prototype.getResourceARNs = function (region, resourceType, tags) {
        return this.doMetricQueryRequest('resource_arns', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            resourceType: this.templateSrv.replace(resourceType),
            tags: tags,
        });
    };
    CloudWatchDatasource.prototype.metricFindQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var region, namespace, metricName, filterJson, regionQuery, namespaceQuery, metricNameQuery, dimensionKeysQuery, dimensionValuesQuery, dimensionKey, ebsVolumeIdsQuery, instanceId, ec2InstanceAttributeQuery, targetAttributeName, resourceARNsQuery, resourceType, tagsJSON, statsQuery;
            return __generator(this, function (_a) {
                regionQuery = query.match(/^regions\(\)/);
                if (regionQuery) {
                    return [2 /*return*/, this.getRegions()];
                }
                namespaceQuery = query.match(/^namespaces\(\)/);
                if (namespaceQuery) {
                    return [2 /*return*/, this.getNamespaces()];
                }
                metricNameQuery = query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
                if (metricNameQuery) {
                    namespace = metricNameQuery[1];
                    region = metricNameQuery[3];
                    return [2 /*return*/, this.getMetrics(namespace, region)];
                }
                dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
                if (dimensionKeysQuery) {
                    namespace = dimensionKeysQuery[1];
                    region = dimensionKeysQuery[3];
                    return [2 /*return*/, this.getDimensionKeys(namespace, region)];
                }
                dimensionValuesQuery = query.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
                if (dimensionValuesQuery) {
                    region = dimensionValuesQuery[1];
                    namespace = dimensionValuesQuery[2];
                    metricName = dimensionValuesQuery[3];
                    dimensionKey = dimensionValuesQuery[4];
                    filterJson = {};
                    if (dimensionValuesQuery[6]) {
                        filterJson = JSON.parse(this.templateSrv.replace(dimensionValuesQuery[6]));
                    }
                    return [2 /*return*/, this.getDimensionValues(region, namespace, metricName, dimensionKey, filterJson)];
                }
                ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
                if (ebsVolumeIdsQuery) {
                    region = ebsVolumeIdsQuery[1];
                    instanceId = ebsVolumeIdsQuery[2];
                    return [2 /*return*/, this.getEbsVolumeIds(region, instanceId)];
                }
                ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
                if (ec2InstanceAttributeQuery) {
                    region = ec2InstanceAttributeQuery[1];
                    targetAttributeName = ec2InstanceAttributeQuery[2];
                    filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
                    return [2 /*return*/, this.getEc2InstanceAttribute(region, targetAttributeName, filterJson)];
                }
                resourceARNsQuery = query.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
                if (resourceARNsQuery) {
                    region = resourceARNsQuery[1];
                    resourceType = resourceARNsQuery[2];
                    tagsJSON = JSON.parse(this.templateSrv.replace(resourceARNsQuery[3]));
                    return [2 /*return*/, this.getResourceARNs(region, resourceType, tagsJSON)];
                }
                statsQuery = query.match(/^statistics\(\)/);
                if (statsQuery) {
                    return [2 /*return*/, this.standardStatistics.map(function (s) { return ({ value: s, label: s, text: s }); })];
                }
                return [2 /*return*/, Promise.resolve([])];
            });
        });
    };
    CloudWatchDatasource.prototype.annotationQuery = function (options) {
        var annotation = options.annotation;
        var statistic = this.templateSrv.replace(annotation.statistic);
        var defaultPeriod = annotation.prefixMatching ? '' : '300';
        var period = annotation.period || defaultPeriod;
        period = parseInt(period, 10);
        var parameters = {
            prefixMatching: annotation.prefixMatching,
            region: this.templateSrv.replace(this.getActualRegion(annotation.region)),
            namespace: this.templateSrv.replace(annotation.namespace),
            metricName: this.templateSrv.replace(annotation.metricName),
            dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
            statistic: statistic,
            period: period,
            actionPrefix: annotation.actionPrefix || '',
            alarmNamePrefix: annotation.alarmNamePrefix || '',
        };
        return lastValueFrom(this.awsRequest(DS_QUERY_ENDPOINT, {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: [
                __assign({ refId: 'annotationQuery', datasourceId: this.id, type: 'annotationQuery' }, parameters),
            ],
        }).pipe(map(function (r) {
            var frames = toDataQueryResponse({ data: r }).data;
            var table = toLegacyResponseData(frames[0]);
            return table.rows.map(function (v) { return ({
                annotation: annotation,
                time: Date.parse(v[0]),
                title: v[1],
                tags: [v[2]],
                text: v[3],
            }); });
        })));
    };
    CloudWatchDatasource.prototype.targetContainsTemplate = function (target) {
        var _this = this;
        var _a;
        return (this.templateSrv.variableExists(target.region) ||
            this.templateSrv.variableExists(target.namespace) ||
            this.templateSrv.variableExists(target.metricName) ||
            this.templateSrv.variableExists(target.expression) ||
            ((_a = target.logGroupNames) === null || _a === void 0 ? void 0 : _a.some(function (logGroup) { return _this.templateSrv.variableExists(logGroup); })) ||
            find(target.dimensions, function (v, k) { return _this.templateSrv.variableExists(k) || _this.templateSrv.variableExists(v); }));
    };
    CloudWatchDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var region, namespace, metricName, dimensions, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        region = this.defaultRegion;
                        namespace = 'AWS/Billing';
                        metricName = 'EstimatedCharges';
                        dimensions = {};
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, {
                                status: 'success',
                                message: 'Data source is working',
                            }];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, toTestingStatus(error_1)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CloudWatchDatasource.prototype.awsRequest = function (url, data, headers) {
        if (headers === void 0) { headers = {}; }
        var options = {
            method: 'POST',
            url: url,
            data: data,
            headers: headers,
        };
        return getBackendSrv()
            .fetch(options)
            .pipe(map(function (result) { return result.data; }));
    };
    CloudWatchDatasource.prototype.getDefaultRegion = function () {
        return this.defaultRegion;
    };
    CloudWatchDatasource.prototype.getActualRegion = function (region) {
        if (region === 'default' || region === undefined || region === '') {
            return this.getDefaultRegion();
        }
        return region;
    };
    CloudWatchDatasource.prototype.showContextToggle = function () {
        return true;
    };
    CloudWatchDatasource.prototype.convertToCloudWatchTime = function (date, roundUp) {
        if (isString(date)) {
            date = dateMath.parse(date, roundUp);
        }
        return Math.round(date.valueOf() / 1000);
    };
    CloudWatchDatasource.prototype.convertDimensionFormat = function (dimensions, scopedVars) {
        var _this = this;
        return Object.entries(dimensions).reduce(function (result, _a) {
            var _b, _c, _d, _e;
            var _f = __read(_a, 2), key = _f[0], value = _f[1];
            key = _this.replace(key, scopedVars, true, 'dimension keys');
            if (Array.isArray(value)) {
                return __assign(__assign({}, result), (_b = {}, _b[key] = value, _b));
            }
            var valueVar = _this.templateSrv
                .getVariables()
                .find(function (_a) {
                var name = _a.name;
                return name === _this.templateSrv.getVariableName(value);
            });
            if (valueVar) {
                if (valueVar.multi) {
                    var values = _this.templateSrv.replace(value, scopedVars, 'pipe').split('|');
                    return __assign(__assign({}, result), (_c = {}, _c[key] = values, _c));
                }
                return __assign(__assign({}, result), (_d = {}, _d[key] = [_this.templateSrv.replace(value, scopedVars)], _d));
            }
            return __assign(__assign({}, result), (_e = {}, _e[key] = [value], _e));
        }, {});
    };
    CloudWatchDatasource.prototype.replace = function (target, scopedVars, displayErrorIfIsMultiTemplateVariable, fieldName) {
        var _this = this;
        if (displayErrorIfIsMultiTemplateVariable && !!target) {
            var variable = this.templateSrv
                .getVariables()
                .find(function (_a) {
                var name = _a.name;
                return name === _this.templateSrv.getVariableName(target);
            });
            if (variable && variable.multi) {
                this.debouncedCustomAlert('CloudWatch templating error', "Multi template variables are not supported for " + (fieldName || target));
            }
        }
        return this.templateSrv.replace(target, scopedVars);
    };
    CloudWatchDatasource.prototype.getQueryDisplayText = function (query) {
        var _a;
        if (query.queryMode === 'Logs') {
            return (_a = query.expression) !== null && _a !== void 0 ? _a : '';
        }
        else {
            return JSON.stringify(query);
        }
    };
    CloudWatchDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        if (!queries.length) {
            return queries;
        }
        return queries.map(function (query) { return (__assign(__assign(__assign({}, query), { region: _this.getActualRegion(_this.replace(query.region, scopedVars)), expression: _this.replace(query.expression, scopedVars) }), (!isCloudWatchLogsQuery(query) && _this.interpolateMetricsQueryVariables(query, scopedVars)))); });
    };
    CloudWatchDatasource.prototype.interpolateMetricsQueryVariables = function (query, scopedVars) {
        var _this = this;
        return {
            alias: this.replace(query.alias, scopedVars),
            metricName: this.replace(query.metricName, scopedVars),
            namespace: this.replace(query.namespace, scopedVars),
            period: this.replace(query.period, scopedVars),
            dimensions: Object.entries(query.dimensions).reduce(function (prev, _a) {
                var _b, _c;
                var _d = __read(_a, 2), key = _d[0], value = _d[1];
                if (Array.isArray(value)) {
                    return __assign(__assign({}, prev), (_b = {}, _b[key] = value, _b));
                }
                return __assign(__assign({}, prev), (_c = {}, _c[_this.replace(key, scopedVars)] = _this.replace(value, scopedVars), _c));
            }, {}),
        };
    };
    return CloudWatchDatasource;
}(DataSourceWithBackend));
export { CloudWatchDatasource };
function withTeardown(observable, onUnsubscribe) {
    return new Observable(function (subscriber) {
        var innerSub = observable.subscribe({
            next: function (val) { return subscriber.next(val); },
            error: function (err) { return subscriber.next(err); },
            complete: function () { return subscriber.complete(); },
        });
        return function () {
            innerSub.unsubscribe();
            onUnsubscribe();
        };
    });
}
function parseLogGroupName(logIdentifier) {
    var colonIndex = logIdentifier.lastIndexOf(':');
    return logIdentifier.substr(colonIndex + 1);
}
//# sourceMappingURL=datasource.js.map