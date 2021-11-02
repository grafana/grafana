import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { cloneDeep, defaults } from 'lodash';
import { forkJoin, lastValueFrom, merge, of, pipe, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import LRU from 'lru-cache';
import { CoreApp, dateMath, LoadingState, rangeUtil, } from '@grafana/data';
import { getBackendSrv, DataSourceWithBackend } from '@grafana/runtime';
import { safeStringifyValue } from 'app/core/utils/explore';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import addLabelToQuery from './add_label_to_query';
import PrometheusLanguageProvider from './language_provider';
import { expandRecordingRules } from './language_utils';
import { getInitHints, getQueryHints } from './query_hints';
import { getOriginalMetricName, renderTemplate, transform, transformV2 } from './result_transformer';
import { isFetchErrorResponse, PromQueryType, } from './types';
import { PrometheusVariableSupport } from './variables';
import PrometheusMetricFindQuery from './metric_find_query';
export var ANNOTATION_QUERY_STEP_DEFAULT = '60s';
var GET_AND_POST_METADATA_ENDPOINTS = ['api/v1/query', 'api/v1/query_range', 'api/v1/series', 'api/v1/labels'];
var PrometheusDatasource = /** @class */ (function (_super) {
    __extends(PrometheusDatasource, _super);
    function PrometheusDatasource(instanceSettings, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _a, _b;
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.metricsNameCache = new LRU(10);
        _this.init = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.loadRules();
                        _a = this;
                        return [4 /*yield*/, this.areExemplarsAvailable()];
                    case 1:
                        _a.exemplarsAvailable = _b.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        _this.prepareTargets = function (options, start, end) {
            var e_1, _a;
            var queries = [];
            var activeTargets = [];
            var clonedTargets = cloneDeep(options.targets);
            var _loop_1 = function (target) {
                if (!target.expr || target.hide) {
                    return "continue";
                }
                target.requestId = options.panelId + target.refId;
                var metricName = _this.languageProvider.histogramMetrics.find(function (m) { return target.expr.includes(m); });
                // In Explore, we run both (instant and range) queries if both are true (selected) or both are undefined (legacy Explore queries)
                if (options.app === CoreApp.Explore && target.range === target.instant) {
                    // Create instant target
                    var instantTarget = cloneDeep(target);
                    instantTarget.format = 'table';
                    instantTarget.instant = true;
                    instantTarget.range = false;
                    instantTarget.valueWithRefId = true;
                    delete instantTarget.maxDataPoints;
                    instantTarget.requestId += '_instant';
                    // Create range target
                    var rangeTarget = cloneDeep(target);
                    rangeTarget.format = 'time_series';
                    rangeTarget.instant = false;
                    instantTarget.range = true;
                    // Create exemplar query
                    if (target.exemplar) {
                        // Only create exemplar target for different metric names
                        if (!metricName ||
                            (metricName && !activeTargets.some(function (activeTarget) { return activeTarget.expr.includes(metricName); }))) {
                            var exemplarTarget = cloneDeep(target);
                            exemplarTarget.instant = false;
                            exemplarTarget.requestId += '_exemplar';
                            queries.push(_this.createQuery(exemplarTarget, options, start, end));
                            activeTargets.push(exemplarTarget);
                        }
                        instantTarget.exemplar = false;
                        rangeTarget.exemplar = false;
                    }
                    // Add both targets to activeTargets and queries arrays
                    activeTargets.push(instantTarget, rangeTarget);
                    queries.push(_this.createQuery(instantTarget, options, start, end), _this.createQuery(rangeTarget, options, start, end));
                    // If running only instant query in Explore, format as table
                }
                else if (target.instant && options.app === CoreApp.Explore) {
                    var instantTarget = cloneDeep(target);
                    instantTarget.format = 'table';
                    queries.push(_this.createQuery(instantTarget, options, start, end));
                    activeTargets.push(instantTarget);
                }
                else {
                    // It doesn't make sense to query for exemplars in dashboard if only instant is selected
                    if (target.exemplar && !target.instant) {
                        if (!metricName ||
                            (metricName && !activeTargets.some(function (activeTarget) { return activeTarget.expr.includes(metricName); }))) {
                            var exemplarTarget = cloneDeep(target);
                            exemplarTarget.requestId += '_exemplar';
                            queries.push(_this.createQuery(exemplarTarget, options, start, end));
                            activeTargets.push(exemplarTarget);
                        }
                        target.exemplar = false;
                    }
                    queries.push(_this.createQuery(target, options, start, end));
                    activeTargets.push(target);
                }
            };
            try {
                for (var clonedTargets_1 = __values(clonedTargets), clonedTargets_1_1 = clonedTargets_1.next(); !clonedTargets_1_1.done; clonedTargets_1_1 = clonedTargets_1.next()) {
                    var target = clonedTargets_1_1.value;
                    _loop_1(target);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (clonedTargets_1_1 && !clonedTargets_1_1.done && (_a = clonedTargets_1.return)) _a.call(clonedTargets_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return {
                queries: queries,
                activeTargets: activeTargets,
            };
        };
        _this.handleErrors = function (err, target) {
            var error = {
                message: (err && err.statusText) || 'Unknown error during query transaction. Please check JS console logs.',
                refId: target.refId,
            };
            if (err.data) {
                if (typeof err.data === 'string') {
                    error.message = err.data;
                }
                else if (err.data.error) {
                    error.message = safeStringifyValue(err.data.error);
                }
            }
            else if (err.message) {
                error.message = err.message;
            }
            else if (typeof err === 'string') {
                error.message = err;
            }
            error.status = err.status;
            error.statusText = err.statusText;
            return error;
        };
        _this.createAnnotationQueryOptions = function (options) {
            var annotation = options.annotation;
            var interval = annotation && annotation.step && typeof annotation.step === 'string'
                ? annotation.step
                : ANNOTATION_QUERY_STEP_DEFAULT;
            return __assign(__assign({}, options), { interval: interval });
        };
        _this.type = 'prometheus';
        _this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
        _this.url = instanceSettings.url;
        _this.access = instanceSettings.access;
        _this.basicAuth = instanceSettings.basicAuth;
        _this.withCredentials = instanceSettings.withCredentials;
        _this.interval = instanceSettings.jsonData.timeInterval || '15s';
        _this.queryTimeout = instanceSettings.jsonData.queryTimeout;
        _this.httpMethod = instanceSettings.jsonData.httpMethod || 'POST';
        // `directUrl` is never undefined, we set it at https://github.com/grafana/grafana/blob/main/pkg/api/frontendsettings.go#L108
        // here we "fall back" to this.url to make typescript happy, but it should never happen
        _this.directUrl = (_a = instanceSettings.jsonData.directUrl) !== null && _a !== void 0 ? _a : _this.url;
        _this.exemplarTraceIdDestinations = instanceSettings.jsonData.exemplarTraceIdDestinations;
        _this.ruleMappings = {};
        _this.languageProvider = new PrometheusLanguageProvider(_this);
        _this.lookupsDisabled = (_b = instanceSettings.jsonData.disableMetricsLookup) !== null && _b !== void 0 ? _b : false;
        _this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
        _this.variables = new PrometheusVariableSupport(_this, _this.templateSrv, _this.timeSrv);
        _this.exemplarsAvailable = true;
        return _this;
    }
    PrometheusDatasource.prototype.getQueryDisplayText = function (query) {
        return query.expr;
    };
    PrometheusDatasource.prototype._addTracingHeaders = function (httpOptions, options) {
        httpOptions.headers = {};
        var proxyMode = !this.url.match(/^http/);
        if (proxyMode) {
            httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
            httpOptions.headers['X-Panel-Id'] = options.panelId;
        }
    };
    /**
     * Any request done from this data source should go through here as it contains some common processing for the
     * request. Any processing done here needs to be also copied on the backend as this goes through data source proxy
     * but not through the same code as alerting.
     */
    PrometheusDatasource.prototype._request = function (url, data, overrides) {
        var e_2, _a;
        if (overrides === void 0) { overrides = {}; }
        data = data || {};
        try {
            for (var _b = __values(this.customQueryParameters), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                if (data[key] == null) {
                    data[key] = value;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        var options = defaults(overrides, {
            url: this.url + url,
            method: this.httpMethod,
            headers: {},
        });
        if (options.method === 'GET') {
            if (data && Object.keys(data).length) {
                options.url =
                    options.url +
                        (options.url.search(/\?/) >= 0 ? '&' : '?') +
                        Object.entries(data)
                            .map(function (_a) {
                            var _b = __read(_a, 2), k = _b[0], v = _b[1];
                            return encodeURIComponent(k) + "=" + encodeURIComponent(v);
                        })
                            .join('&');
            }
        }
        else {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.data = data;
        }
        if (this.basicAuth || this.withCredentials) {
            options.withCredentials = true;
        }
        if (this.basicAuth) {
            options.headers.Authorization = this.basicAuth;
        }
        return getBackendSrv().fetch(options);
    };
    // Use this for tab completion features, wont publish response to other components
    PrometheusDatasource.prototype.metadataRequest = function (url, params) {
        if (params === void 0) { params = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!GET_AND_POST_METADATA_ENDPOINTS.some(function (endpoint) { return url.includes(endpoint); })) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, lastValueFrom(this._request(url, params, { method: this.httpMethod, hideFromInspector: true }))];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        err_1 = _a.sent();
                        // If status code of error is Method Not Allowed (405) and HTTP method is POST, retry with GET
                        if (this.httpMethod === 'POST' && err_1.status === 405) {
                            console.warn("Couldn't use configured POST HTTP method for this request. Trying to use GET method instead.");
                        }
                        else {
                            throw err_1;
                        }
                        return [3 /*break*/, 4];
                    case 4: return [4 /*yield*/, lastValueFrom(this._request(url, params, { method: 'GET', hideFromInspector: true }))];
                    case 5: return [2 /*return*/, _a.sent()]; // toPromise until we change getTagValues, getTagKeys to Observable
                }
            });
        });
    };
    PrometheusDatasource.prototype.interpolateQueryExpr = function (value, variable) {
        if (value === void 0) { value = []; }
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return prometheusRegularEscape(value);
        }
        if (typeof value === 'string') {
            return prometheusSpecialRegexEscape(value);
        }
        var escapedValues = value.map(function (val) { return prometheusSpecialRegexEscape(val); });
        if (escapedValues.length === 1) {
            return escapedValues[0];
        }
        return '(' + escapedValues.join('|') + ')';
    };
    PrometheusDatasource.prototype.targetContainsTemplate = function (target) {
        return this.templateSrv.variableExists(target.expr);
    };
    PrometheusDatasource.prototype.shouldRunExemplarQuery = function (target) {
        /* We want to run exemplar query only for histogram metrics:
        1. If we haven't processd histogram metrics yet, we need to check if expr includes "_bucket" which means that it is probably histogram metric (can rarely lead to false positive).
        2. If we have processed histogram metrics, check if it is part of query expr.
        */
        if (target.exemplar) {
            var histogramMetrics = this.languageProvider.histogramMetrics;
            if (histogramMetrics.length > 0) {
                return !!histogramMetrics.find(function (metric) { return target.expr.includes(metric); });
            }
            else {
                return target.expr.includes('_bucket');
            }
        }
        return false;
    };
    PrometheusDatasource.prototype.processTargetV2 = function (target, request) {
        var processedTarget = __assign(__assign({}, target), { queryType: PromQueryType.timeSeriesQuery, exemplar: this.shouldRunExemplarQuery(target), requestId: request.panelId + target.refId, 
            // We need to pass utcOffsetSec to backend to calculate aligned range
            utcOffsetSec: this.timeSrv.timeRange().to.utcOffset() * 60 });
        return processedTarget;
    };
    PrometheusDatasource.prototype.query = function (request) {
        var _this = this;
        if (this.access === 'proxy') {
            var targets = request.targets.map(function (target) { return _this.processTargetV2(target, request); });
            return _super.prototype.query.call(this, __assign(__assign({}, request), { targets: targets }))
                .pipe(map(function (response) {
                return transformV2(response, request, { exemplarTraceIdDestinations: _this.exemplarTraceIdDestinations });
            }));
            // Run queries trough browser/proxy
        }
        else {
            var start = this.getPrometheusTime(request.range.from, false);
            var end = this.getPrometheusTime(request.range.to, true);
            var _a = this.prepareTargets(request, start, end), queries = _a.queries, activeTargets = _a.activeTargets;
            // No valid targets, return the empty result to save a round trip.
            if (!queries || !queries.length) {
                return of({
                    data: [],
                    state: LoadingState.Done,
                });
            }
            if (request.app === CoreApp.Explore) {
                return this.exploreQuery(queries, activeTargets, end);
            }
            return this.panelsQuery(queries, activeTargets, end, request.requestId, request.scopedVars);
        }
    };
    PrometheusDatasource.prototype.exploreQuery = function (queries, activeTargets, end) {
        var _this = this;
        var runningQueriesCount = queries.length;
        var subQueries = queries.map(function (query, index) {
            var target = activeTargets[index];
            var filterAndMapResponse = pipe(
            // Decrease the counter here. We assume that each request returns only single value and then completes
            // (should hold until there is some streaming requests involved).
            tap(function () { return runningQueriesCount--; }), filter(function (response) { return (response.cancelled ? false : true); }), map(function (response) {
                var data = transform(response, {
                    query: query,
                    target: target,
                    responseListLength: queries.length,
                    exemplarTraceIdDestinations: _this.exemplarTraceIdDestinations,
                });
                return {
                    data: data,
                    key: query.requestId,
                    state: runningQueriesCount === 0 ? LoadingState.Done : LoadingState.Loading,
                };
            }));
            return _this.runQuery(query, end, filterAndMapResponse);
        });
        return merge.apply(void 0, __spreadArray([], __read(subQueries), false));
    };
    PrometheusDatasource.prototype.panelsQuery = function (queries, activeTargets, end, requestId, scopedVars) {
        var _this = this;
        var observables = queries.map(function (query, index) {
            var target = activeTargets[index];
            var filterAndMapResponse = pipe(filter(function (response) { return (response.cancelled ? false : true); }), map(function (response) {
                var data = transform(response, {
                    query: query,
                    target: target,
                    responseListLength: queries.length,
                    scopedVars: scopedVars,
                    exemplarTraceIdDestinations: _this.exemplarTraceIdDestinations,
                });
                return data;
            }));
            return _this.runQuery(query, end, filterAndMapResponse);
        });
        return forkJoin(observables).pipe(map(function (results) {
            var data = results.reduce(function (result, current) {
                return __spreadArray(__spreadArray([], __read(result), false), __read(current), false);
            }, []);
            return {
                data: data,
                key: requestId,
                state: LoadingState.Done,
            };
        }));
    };
    PrometheusDatasource.prototype.runQuery = function (query, end, filter) {
        if (query.instant) {
            return this.performInstantQuery(query, end).pipe(filter);
        }
        if (query.exemplar) {
            return this.getExemplars(query).pipe(catchError(function () {
                return of({
                    data: [],
                    state: LoadingState.Done,
                });
            }), filter);
        }
        return this.performTimeSeriesQuery(query, query.start, query.end).pipe(filter);
    };
    PrometheusDatasource.prototype.createQuery = function (target, options, start, end) {
        var query = {
            hinting: target.hinting,
            instant: target.instant,
            exemplar: target.exemplar,
            step: 0,
            expr: '',
            requestId: target.requestId,
            refId: target.refId,
            start: 0,
            end: 0,
        };
        var range = Math.ceil(end - start);
        // options.interval is the dynamically calculated interval
        var interval = rangeUtil.intervalToSeconds(options.interval);
        // Minimum interval ("Min step"), if specified for the query, or same as interval otherwise.
        var minInterval = rangeUtil.intervalToSeconds(this.templateSrv.replace(target.interval || options.interval, options.scopedVars));
        // Scrape interval as specified for the query ("Min step") or otherwise taken from the datasource.
        // Min step field can have template variables in it, make sure to replace it.
        var scrapeInterval = target.interval
            ? rangeUtil.intervalToSeconds(this.templateSrv.replace(target.interval, options.scopedVars))
            : rangeUtil.intervalToSeconds(this.interval);
        var intervalFactor = target.intervalFactor || 1;
        // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
        var adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
        var scopedVars = __assign(__assign(__assign({}, options.scopedVars), this.getRangeScopedVars(options.range)), this.getRateIntervalScopedVariable(adjustedInterval, scrapeInterval));
        // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
        if (interval !== adjustedInterval) {
            interval = adjustedInterval;
            scopedVars = Object.assign({}, options.scopedVars, __assign(__assign({ __interval: { text: interval + 's', value: interval + 's' }, __interval_ms: { text: interval * 1000, value: interval * 1000 } }, this.getRateIntervalScopedVariable(interval, scrapeInterval)), this.getRangeScopedVars(options.range)));
        }
        query.step = interval;
        var expr = target.expr;
        // Apply adhoc filters
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        expr = adhocFilters.reduce(function (acc, filter) {
            var key = filter.key, operator = filter.operator;
            var value = filter.value;
            if (operator === '=~' || operator === '!~') {
                value = prometheusRegularEscape(value);
            }
            return addLabelToQuery(acc, key, value, operator);
        }, expr);
        // Only replace vars in expression after having (possibly) updated interval vars
        query.expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);
        // Align query interval with step to allow query caching and to ensure
        // that about-same-time query results look the same.
        var adjusted = alignRange(start, end, query.step, this.timeSrv.timeRange().to.utcOffset() * 60);
        query.start = adjusted.start;
        query.end = adjusted.end;
        this._addTracingHeaders(query, options);
        return query;
    };
    PrometheusDatasource.prototype.getRateIntervalScopedVariable = function (interval, scrapeInterval) {
        // Fall back to the default scrape interval of 15s if scrapeInterval is 0 for some reason.
        if (scrapeInterval === 0) {
            scrapeInterval = 15;
        }
        var rateInterval = Math.max(interval + scrapeInterval, 4 * scrapeInterval);
        return { __rate_interval: { text: rateInterval + 's', value: rateInterval + 's' } };
    };
    PrometheusDatasource.prototype.adjustInterval = function (interval, minInterval, range, intervalFactor) {
        // Prometheus will drop queries that might return more than 11000 data points.
        // Calculate a safe interval as an additional minimum to take into account.
        // Fractional safeIntervals are allowed, however serve little purpose if the interval is greater than 1
        // If this is the case take the ceil of the value.
        var safeInterval = range / 11000;
        if (safeInterval > 1) {
            safeInterval = Math.ceil(safeInterval);
        }
        return Math.max(interval * intervalFactor, minInterval, safeInterval);
    };
    PrometheusDatasource.prototype.performTimeSeriesQuery = function (query, start, end) {
        var _this = this;
        if (start > end) {
            throw { message: 'Invalid time range' };
        }
        var url = '/api/v1/query_range';
        var data = {
            query: query.expr,
            start: start,
            end: end,
            step: query.step,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(url, data, {
            requestId: query.requestId,
            headers: query.headers,
        }).pipe(catchError(function (err) {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(_this.handleErrors(err, query));
        }));
    };
    PrometheusDatasource.prototype.performInstantQuery = function (query, time) {
        var _this = this;
        var url = '/api/v1/query';
        var data = {
            query: query.expr,
            time: time,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(url, data, {
            requestId: query.requestId,
            headers: query.headers,
        }).pipe(catchError(function (err) {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(_this.handleErrors(err, query));
        }));
    };
    PrometheusDatasource.prototype.metricFindQuery = function (query) {
        if (!query) {
            return Promise.resolve([]);
        }
        var scopedVars = __assign({ __interval: { text: this.interval, value: this.interval }, __interval_ms: { text: rangeUtil.intervalToMs(this.interval), value: rangeUtil.intervalToMs(this.interval) } }, this.getRangeScopedVars(this.timeSrv.timeRange()));
        var interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
        var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
        return metricFindQuery.process();
    };
    PrometheusDatasource.prototype.getRangeScopedVars = function (range) {
        if (range === void 0) { range = this.timeSrv.timeRange(); }
        var msRange = range.to.diff(range.from);
        var sRange = Math.round(msRange / 1000);
        return {
            __range_ms: { text: msRange, value: msRange },
            __range_s: { text: sRange, value: sRange },
            __range: { text: sRange + 's', value: sRange + 's' },
        };
    };
    PrometheusDatasource.prototype.annotationQuery = function (options) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var annotation, _e, expr, _f, tagKeys, _g, titleFormat, _h, textFormat, start, end, queryOptions, minStep, queryModel, query, response, eventList, splitKeys, step;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        annotation = options.annotation;
                        _e = annotation.expr, expr = _e === void 0 ? '' : _e, _f = annotation.tagKeys, tagKeys = _f === void 0 ? '' : _f, _g = annotation.titleFormat, titleFormat = _g === void 0 ? '' : _g, _h = annotation.textFormat, textFormat = _h === void 0 ? '' : _h;
                        if (!expr) {
                            return [2 /*return*/, Promise.resolve([])];
                        }
                        start = this.getPrometheusTime(options.range.from, false);
                        end = this.getPrometheusTime(options.range.to, true);
                        queryOptions = this.createAnnotationQueryOptions(options);
                        minStep = '1s';
                        queryModel = {
                            expr: expr,
                            interval: minStep,
                            refId: 'X',
                            requestId: "prom-query-" + annotation.name,
                        };
                        query = this.createQuery(queryModel, queryOptions, start, end);
                        return [4 /*yield*/, lastValueFrom(this.performTimeSeriesQuery(query, query.start, query.end))];
                    case 1:
                        response = _j.sent();
                        eventList = [];
                        splitKeys = tagKeys.split(',');
                        if (isFetchErrorResponse(response) && response.cancelled) {
                            return [2 /*return*/, []];
                        }
                        step = Math.floor((_a = query.step) !== null && _a !== void 0 ? _a : 15) * 1000;
                        (_d = (_c = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.result) === null || _d === void 0 ? void 0 : _d.forEach(function (series) {
                            var e_3, _a;
                            var _b;
                            var tags = Object.entries(series.metric)
                                .filter(function (_a) {
                                var _b = __read(_a, 1), k = _b[0];
                                return splitKeys.includes(k);
                            })
                                .map(function (_a) {
                                var _b = __read(_a, 2), _k = _b[0], v = _b[1];
                                return v;
                            });
                            series.values.forEach(function (value) {
                                var timestampValue;
                                // rewrite timeseries to a common format
                                if (annotation.useValueForTime) {
                                    timestampValue = Math.floor(parseFloat(value[1]));
                                    value[1] = 1;
                                }
                                else {
                                    timestampValue = Math.floor(parseFloat(value[0])) * 1000;
                                }
                                value[0] = timestampValue;
                            });
                            var activeValues = series.values.filter(function (value) { return parseFloat(value[1]) >= 1; });
                            var activeValuesTimestamps = activeValues.map(function (value) { return value[0]; });
                            // Instead of creating singular annotation for each active event we group events into region if they are less
                            // then `step` apart.
                            var latestEvent = null;
                            try {
                                for (var activeValuesTimestamps_1 = __values(activeValuesTimestamps), activeValuesTimestamps_1_1 = activeValuesTimestamps_1.next(); !activeValuesTimestamps_1_1.done; activeValuesTimestamps_1_1 = activeValuesTimestamps_1.next()) {
                                    var timestamp = activeValuesTimestamps_1_1.value;
                                    // We already have event `open` and we have new event that is inside the `step` so we just update the end.
                                    if (latestEvent && ((_b = latestEvent.timeEnd) !== null && _b !== void 0 ? _b : 0) + step >= timestamp) {
                                        latestEvent.timeEnd = timestamp;
                                        continue;
                                    }
                                    // Event exists but new one is outside of the `step` so we "finish" the current region.
                                    if (latestEvent) {
                                        eventList.push(latestEvent);
                                    }
                                    // We start a new region.
                                    latestEvent = {
                                        time: timestamp,
                                        timeEnd: timestamp,
                                        annotation: annotation,
                                        title: renderTemplate(titleFormat, series.metric),
                                        tags: tags,
                                        text: renderTemplate(textFormat, series.metric),
                                    };
                                }
                            }
                            catch (e_3_1) { e_3 = { error: e_3_1 }; }
                            finally {
                                try {
                                    if (activeValuesTimestamps_1_1 && !activeValuesTimestamps_1_1.done && (_a = activeValuesTimestamps_1.return)) _a.call(activeValuesTimestamps_1);
                                }
                                finally { if (e_3) throw e_3.error; }
                            }
                            if (latestEvent) {
                                // finish up last point if we have one
                                latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
                                eventList.push(latestEvent);
                            }
                        });
                        return [2 /*return*/, eventList];
                }
            });
        });
    };
    PrometheusDatasource.prototype.getExemplars = function (query) {
        var url = '/api/v1/query_exemplars';
        return this._request(url, { query: query.expr, start: query.start.toString(), end: query.end.toString() }, { requestId: query.requestId, headers: query.headers });
    };
    PrometheusDatasource.prototype.getTagKeys = function () {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.metadataRequest('/api/v1/labels')];
                    case 1:
                        result = _d.sent();
                        return [2 /*return*/, (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.map(function (value) { return ({ text: value }); })) !== null && _c !== void 0 ? _c : []];
                }
            });
        });
    };
    PrometheusDatasource.prototype.getTagValues = function (options) {
        var _a, _b, _c;
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.metadataRequest("/api/v1/label/" + options.key + "/values")];
                    case 1:
                        result = _d.sent();
                        return [2 /*return*/, (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.map(function (value) { return ({ text: value }); })) !== null && _c !== void 0 ? _c : []];
                }
            });
        });
    };
    PrometheusDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, query, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().getTime();
                        query = { expr: '1+1' };
                        return [4 /*yield*/, lastValueFrom(this.performInstantQuery(query, now / 1000))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.status === 'success'
                                ? { status: 'success', message: 'Data source is working' }
                                : { status: 'error', message: response.data.error }];
                }
            });
        });
    };
    PrometheusDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        var expandedQueries = queries;
        if (queries && queries.length) {
            expandedQueries = queries.map(function (query) {
                var expandedQuery = __assign(__assign({}, query), { datasource: _this.getRef(), expr: _this.templateSrv.replace(query.expr, scopedVars, _this.interpolateQueryExpr), interval: _this.templateSrv.replace(query.interval, scopedVars) });
                return expandedQuery;
            });
        }
        return expandedQueries;
    };
    PrometheusDatasource.prototype.getQueryHints = function (query, result) {
        var _a;
        return getQueryHints((_a = query.expr) !== null && _a !== void 0 ? _a : '', result, this);
    };
    PrometheusDatasource.prototype.getInitHints = function () {
        return getInitHints(this);
    };
    PrometheusDatasource.prototype.loadRules = function () {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var res, groups, e_4;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.metadataRequest('/api/v1/rules')];
                    case 1:
                        res = _c.sent();
                        groups = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.groups;
                        if (groups) {
                            this.ruleMappings = extractRuleMappingFromGroups(groups);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        e_4 = _c.sent();
                        console.log('Rules API is experimental. Ignore next error.');
                        console.error(e_4);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    PrometheusDatasource.prototype.areExemplarsAvailable = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.metadataRequest('/api/v1/query_exemplars', { query: 'test' })];
                    case 1:
                        res = _a.sent();
                        if (res.data.status === 'success') {
                            return [2 /*return*/, true];
                        }
                        return [2 /*return*/, false];
                    case 2:
                        err_2 = _a.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    PrometheusDatasource.prototype.modifyQuery = function (query, action) {
        var _a;
        var expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        switch (action.type) {
            case 'ADD_FILTER': {
                expression = addLabelToQuery(expression, action.key, action.value);
                break;
            }
            case 'ADD_FILTER_OUT': {
                expression = addLabelToQuery(expression, action.key, action.value, '!=');
                break;
            }
            case 'ADD_HISTOGRAM_QUANTILE': {
                expression = "histogram_quantile(0.95, sum(rate(" + expression + "[5m])) by (le))";
                break;
            }
            case 'ADD_RATE': {
                expression = "rate(" + expression + "[5m])";
                break;
            }
            case 'ADD_SUM': {
                expression = "sum(" + expression.trim() + ") by ($1)";
                break;
            }
            case 'EXPAND_RULES': {
                if (action.mapping) {
                    expression = expandRecordingRules(expression, action.mapping);
                }
                break;
            }
            default:
                break;
        }
        return __assign(__assign({}, query), { expr: expression });
    };
    PrometheusDatasource.prototype.getPrometheusTime = function (date, roundUp) {
        if (typeof date === 'string') {
            date = dateMath.parse(date, roundUp);
        }
        return Math.ceil(date.valueOf() / 1000);
    };
    PrometheusDatasource.prototype.getTimeRangeParams = function () {
        var range = this.timeSrv.timeRange();
        return {
            start: this.getPrometheusTime(range.from, false).toString(),
            end: this.getPrometheusTime(range.to, true).toString(),
        };
    };
    PrometheusDatasource.prototype.getOriginalMetricName = function (labelData) {
        return getOriginalMetricName(labelData);
    };
    // Used when running queries trough backend
    PrometheusDatasource.prototype.filterQuery = function (query) {
        if (query.hide || !query.expr) {
            return false;
        }
        return true;
    };
    // Used when running queries trough backend
    PrometheusDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var variables = cloneDeep(scopedVars);
        // We want to interpolate these variables on backend
        delete variables.__interval;
        delete variables.__interval_ms;
        return __assign(__assign({}, target), { legendFormat: this.templateSrv.replace(target.legendFormat, variables), expr: this.templateSrv.replace(target.expr, variables, this.interpolateQueryExpr) });
    };
    return PrometheusDatasource;
}(DataSourceWithBackend));
export { PrometheusDatasource };
/**
 * Align query range to step.
 * Rounds start and end down to a multiple of step.
 * @param start Timestamp marking the beginning of the range.
 * @param end Timestamp marking the end of the range.
 * @param step Interval to align start and end with.
 * @param utcOffsetSec Number of seconds current timezone is offset from UTC
 */
export function alignRange(start, end, step, utcOffsetSec) {
    var alignedEnd = Math.floor((end + utcOffsetSec) / step) * step - utcOffsetSec;
    var alignedStart = Math.floor((start + utcOffsetSec) / step) * step - utcOffsetSec;
    return {
        end: alignedEnd,
        start: alignedStart,
    };
}
export function extractRuleMappingFromGroups(groups) {
    return groups.reduce(function (mapping, group) {
        return group.rules
            .filter(function (rule) { return rule.type === 'recording'; })
            .reduce(function (acc, rule) {
            var _a;
            return (__assign(__assign({}, acc), (_a = {}, _a[rule.name] = rule.query, _a)));
        }, mapping);
    }, {});
}
// NOTE: these two functions are very similar to the escapeLabelValueIn* functions
// in language_utils.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.
export function prometheusRegularEscape(value) {
    return typeof value === 'string' ? value.replace(/\\/g, '\\\\').replace(/'/g, "\\\\'") : value;
}
export function prometheusSpecialRegexEscape(value) {
    return typeof value === 'string' ? value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&') : value;
}
//# sourceMappingURL=datasource.js.map