import { __assign, __awaiter, __extends, __generator, __rest, __values } from "tslib";
import { cloneDeep, extend, get, has, isString, map as _map, omit, pick, reduce } from 'lodash';
import { lastValueFrom, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DataSourceWithBackend, frameToMetricFindValue, getBackendSrv } from '@grafana/runtime';
import { ArrayVector, dateMath, dateTime, FieldType, LoadingState, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, } from '@grafana/data';
import InfluxSeries from './influx_series';
import InfluxQueryModel from './influx_query_model';
import ResponseParser from './response_parser';
import { InfluxQueryBuilder } from './query_builder';
import { InfluxVersion } from './types';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { FluxQueryEditor } from './components/FluxQueryEditor';
import { buildRawQuery } from './queryUtils';
// we detect the field type based on the value-array
function getFieldType(values) {
    // the values-array may contain a lot of nulls.
    // we need the first not-null item
    var firstNotNull = values.find(function (v) { return v !== null; });
    if (firstNotNull === undefined) {
        // we could not find any not-null values
        return FieldType.number;
    }
    var valueType = typeof firstNotNull;
    switch (valueType) {
        case 'string':
            return FieldType.string;
        case 'boolean':
            return FieldType.boolean;
        case 'number':
            return FieldType.number;
        default:
            // this should never happen, influxql values
            // can only be numbers, strings and booleans.
            throw new Error("InfluxQL: invalid value type " + valueType);
    }
}
// this conversion function is specialized to work with the timeseries
// data returned by InfluxDatasource.getTimeSeries()
function timeSeriesToDataFrame(timeSeries) {
    var e_1, _a;
    var times = [];
    var values = [];
    // the data we process here is not correctly typed.
    // the typescript types say every data-point is number|null,
    // but in fact it can be string or boolean too.
    var points = timeSeries.datapoints;
    try {
        for (var points_1 = __values(points), points_1_1 = points_1.next(); !points_1_1.done; points_1_1 = points_1.next()) {
            var point = points_1_1.value;
            values.push(point[0]);
            times.push(point[1]);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (points_1_1 && !points_1_1.done && (_a = points_1.return)) _a.call(points_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var timeField = {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: new ArrayVector(times),
    };
    var valueField = {
        name: TIME_SERIES_VALUE_FIELD_NAME,
        type: getFieldType(values),
        config: {
            displayNameFromDS: timeSeries.title,
        },
        values: new ArrayVector(values),
        labels: timeSeries.tags,
    };
    var fields = [timeField, valueField];
    return {
        name: timeSeries.target,
        refId: timeSeries.refId,
        meta: timeSeries.meta,
        fields: fields,
        length: values.length,
    };
}
var InfluxDatasource = /** @class */ (function (_super) {
    __extends(InfluxDatasource, _super);
    function InfluxDatasource(instanceSettings, templateSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _a, _b, _c;
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.type = 'influxdb';
        _this.urls = ((_a = instanceSettings.url) !== null && _a !== void 0 ? _a : '').split(',').map(function (url) {
            return url.trim();
        });
        _this.username = (_b = instanceSettings.username) !== null && _b !== void 0 ? _b : '';
        _this.password = (_c = instanceSettings.password) !== null && _c !== void 0 ? _c : '';
        _this.name = instanceSettings.name;
        _this.database = instanceSettings.database;
        _this.basicAuth = instanceSettings.basicAuth;
        _this.withCredentials = instanceSettings.withCredentials;
        var settingsData = instanceSettings.jsonData || {};
        _this.interval = settingsData.timeInterval;
        _this.httpMode = settingsData.httpMode || 'GET';
        _this.responseParser = new ResponseParser();
        _this.isFlux = settingsData.version === InfluxVersion.Flux;
        if (_this.isFlux) {
            // When flux, use an annotation processor rather than the `annotationQuery` lifecycle
            _this.annotations = {
                QueryEditor: FluxQueryEditor,
            };
        }
        return _this;
    }
    InfluxDatasource.prototype.query = function (request) {
        if (this.isFlux) {
            // for not-flux queries we call `this.classicQuery`, and that
            // handles the is-hidden situation.
            // for the flux-case, we do the filtering here
            var filteredRequest = __assign(__assign({}, request), { targets: request.targets.filter(function (t) { return t.hide !== true; }) });
            return _super.prototype.query.call(this, filteredRequest);
        }
        // Fallback to classic query support
        return this.classicQuery(request);
    };
    InfluxDatasource.prototype.getQueryDisplayText = function (query) {
        if (this.isFlux) {
            return query.query;
        }
        return new InfluxQueryModel(query).render(false);
    };
    /**
     * Returns false if the query should be skipped
     */
    InfluxDatasource.prototype.filterQuery = function (query) {
        if (this.isFlux) {
            return !!query.query;
        }
        return true;
    };
    InfluxDatasource.prototype.applyTemplateVariables = function (query, scopedVars) {
        var _a;
        // this only works in flux-mode, it should not be called in non-flux-mode
        if (!this.isFlux) {
            throw new Error('applyTemplateVariables called in influxql-mode. this should never happen');
        }
        // We want to interpolate these variables on backend
        var __interval = scopedVars.__interval, __interval_ms = scopedVars.__interval_ms, rest = __rest(scopedVars, ["__interval", "__interval_ms"]);
        return __assign(__assign({}, query), { query: this.templateSrv.replace((_a = query.query) !== null && _a !== void 0 ? _a : '', rest) });
    };
    /**
     * The unchanged pre 7.1 query implementation
     */
    InfluxDatasource.prototype.classicQuery = function (options) {
        var _this = this;
        var timeFilter = this.getTimeFilter(options);
        var scopedVars = options.scopedVars;
        var targets = cloneDeep(options.targets);
        var queryTargets = [];
        var i, y;
        var allQueries = _map(targets, function (target) {
            if (target.hide) {
                return '';
            }
            queryTargets.push(target);
            // backward compatibility
            scopedVars.interval = scopedVars.__interval;
            return new InfluxQueryModel(target, _this.templateSrv, scopedVars).render(true);
        }).reduce(function (acc, current) {
            if (current !== '') {
                acc += ';' + current;
            }
            return acc;
        });
        if (allQueries === '') {
            return of({ data: [] });
        }
        // add global adhoc filters to timeFilter
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        if (adhocFilters.length > 0) {
            var tmpQuery = new InfluxQueryModel({ refId: 'A' }, this.templateSrv, scopedVars);
            timeFilter += ' AND ' + tmpQuery.renderAdhocFilters(adhocFilters);
        }
        // replace grafana variables
        scopedVars.timeFilter = { value: timeFilter };
        // replace templated variables
        allQueries = this.templateSrv.replace(allQueries, scopedVars);
        return this._seriesQuery(allQueries, options).pipe(map(function (data) {
            if (!data || !data.results) {
                return { data: [] };
            }
            var seriesList = [];
            for (i = 0; i < data.results.length; i++) {
                var result = data.results[i];
                if (!result || !result.series) {
                    continue;
                }
                var target = queryTargets[i];
                var alias = target.alias;
                if (alias) {
                    alias = _this.templateSrv.replace(target.alias, options.scopedVars);
                }
                var meta = {
                    executedQueryString: data.executedQueryString,
                };
                var influxSeries = new InfluxSeries({
                    refId: target.refId,
                    series: data.results[i].series,
                    alias: alias,
                    meta: meta,
                });
                switch (target.resultFormat) {
                    case 'logs':
                        meta.preferredVisualisationType = 'logs';
                    case 'table': {
                        seriesList.push(influxSeries.getTable());
                        break;
                    }
                    default: {
                        var timeSeries = influxSeries.getTimeSeries();
                        for (y = 0; y < timeSeries.length; y++) {
                            seriesList.push(timeSeriesToDataFrame(timeSeries[y]));
                        }
                        break;
                    }
                }
            }
            return { data: seriesList };
        }));
    };
    InfluxDatasource.prototype.annotationQuery = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var timeFilter, query;
            return __generator(this, function (_a) {
                if (this.isFlux) {
                    return [2 /*return*/, Promise.reject({
                            message: 'Flux requires the standard annotation query',
                        })];
                }
                // InfluxQL puts a query string on the annotation
                if (!options.annotation.query) {
                    return [2 /*return*/, Promise.reject({
                            message: 'Query missing in annotation definition',
                        })];
                }
                timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw, timezone: options.dashboard.timezone });
                query = options.annotation.query.replace('$timeFilter', timeFilter);
                query = this.templateSrv.replace(query, undefined, 'regex');
                return [2 /*return*/, lastValueFrom(this._seriesQuery(query, options)).then(function (data) {
                        if (!data || !data.results || !data.results[0]) {
                            throw { message: 'No results in response from InfluxDB' };
                        }
                        return new InfluxSeries({
                            series: data.results[0].series,
                            annotation: options.annotation,
                        }).getAnnotations();
                    })];
            });
        });
    };
    InfluxDatasource.prototype.targetContainsTemplate = function (target) {
        // for flux-mode we just take target.query,
        // for influxql-mode we use InfluxQueryModel to create the text-representation
        var queryText = this.isFlux ? target.query : buildRawQuery(target);
        return this.templateSrv.variableExists(queryText);
    };
    InfluxDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        if (!queries || queries.length === 0) {
            return [];
        }
        var expandedQueries = queries;
        if (queries && queries.length > 0) {
            expandedQueries = queries.map(function (query) {
                var _a, _b, _c;
                var expandedQuery = __assign(__assign({}, query), { datasource: _this.getRef(), measurement: _this.templateSrv.replace((_a = query.measurement) !== null && _a !== void 0 ? _a : '', scopedVars, 'regex'), policy: _this.templateSrv.replace((_b = query.policy) !== null && _b !== void 0 ? _b : '', scopedVars, 'regex') });
                if (query.rawQuery || _this.isFlux) {
                    expandedQuery.query = _this.templateSrv.replace((_c = query.query) !== null && _c !== void 0 ? _c : '', scopedVars, 'regex');
                }
                if (query.tags) {
                    expandedQuery.tags = query.tags.map(function (tag) {
                        return __assign(__assign({}, tag), { value: _this.templateSrv.replace(tag.value, undefined, 'regex') });
                    });
                }
                return expandedQuery;
            });
        }
        return expandedQueries;
    };
    InfluxDatasource.prototype.metricFindQuery = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var target, interpolated;
            var _this = this;
            return __generator(this, function (_a) {
                if (this.isFlux) {
                    target = {
                        refId: 'metricFindQuery',
                        query: query,
                    };
                    return [2 /*return*/, lastValueFrom(_super.prototype.query.call(this, __assign(__assign({}, options), { targets: [target] }))).then(function (rsp) {
                            var _a;
                            if ((_a = rsp.data) === null || _a === void 0 ? void 0 : _a.length) {
                                return frameToMetricFindValue(rsp.data[0]);
                            }
                            return [];
                        })];
                }
                interpolated = this.templateSrv.replace(query, undefined, 'regex');
                return [2 /*return*/, lastValueFrom(this._seriesQuery(interpolated, options)).then(function (resp) {
                        return _this.responseParser.parse(query, resp);
                    })];
            });
        });
    };
    InfluxDatasource.prototype.getTagKeys = function (options) {
        if (options === void 0) { options = {}; }
        var queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('TAG_KEYS');
        return this.metricFindQuery(query, options);
    };
    InfluxDatasource.prototype.getTagValues = function (options) {
        if (options === void 0) { options = {}; }
        var queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
        return this.metricFindQuery(query, options);
    };
    InfluxDatasource.prototype._seriesQuery = function (query, options) {
        if (!query) {
            return of({ results: [] });
        }
        if (options && options.range) {
            var timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
            query = query.replace('$timeFilter', timeFilter);
        }
        return this._influxRequest(this.httpMode, '/query', { q: query, epoch: 'ms' }, options);
    };
    InfluxDatasource.prototype.serializeParams = function (params) {
        if (!params) {
            return '';
        }
        return reduce(params, function (memo, value, key) {
            if (value === null || value === undefined) {
                return memo;
            }
            memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            return memo;
        }, []).join('&');
    };
    InfluxDatasource.prototype.testDatasource = function () {
        if (this.isFlux) {
            // TODO: eventually use the real /health endpoint
            var request = {
                targets: [{ refId: 'test', query: 'buckets()' }],
                requestId: this.id + "-health-" + uuidv4(),
                dashboardId: 0,
                panelId: 0,
                interval: '1m',
                intervalMs: 60000,
                maxDataPoints: 423,
                range: {
                    from: dateTime(1000),
                    to: dateTime(2000),
                },
            };
            return lastValueFrom(_super.prototype.query.call(this, request))
                .then(function (res) {
                if (!res || !res.data || res.state !== LoadingState.Done) {
                    console.error('InfluxDB Error', res);
                    return { status: 'error', message: 'Error reading InfluxDB' };
                }
                var first = res.data[0];
                if (first && first.length) {
                    return { status: 'success', message: first.length + " buckets found" };
                }
                console.error('InfluxDB Error', res);
                return { status: 'error', message: 'Error reading buckets' };
            })
                .catch(function (err) {
                console.error('InfluxDB Error', err);
                return { status: 'error', message: err.message };
            });
        }
        var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('RETENTION POLICIES');
        return lastValueFrom(this._seriesQuery(query))
            .then(function (res) {
            var error = get(res, 'results[0].error');
            if (error) {
                return { status: 'error', message: error };
            }
            return { status: 'success', message: 'Data source is working' };
        })
            .catch(function (err) {
            return { status: 'error', message: err.message };
        });
    };
    InfluxDatasource.prototype._influxRequest = function (method, url, data, options) {
        var _this = this;
        var currentUrl = this.urls.shift();
        this.urls.push(currentUrl);
        var params = {};
        if (this.username) {
            params.u = this.username;
            params.p = this.password;
        }
        if (options && options.database) {
            params.db = options.database;
        }
        else if (this.database) {
            params.db = this.database;
        }
        var q = data.q;
        if (method === 'POST' && has(data, 'q')) {
            // verb is POST and 'q' param is defined
            extend(params, omit(data, ['q']));
            data = this.serializeParams(pick(data, ['q']));
        }
        else if (method === 'GET' || method === 'POST') {
            // verb is GET, or POST without 'q' param
            extend(params, data);
            data = null;
        }
        var req = {
            method: method,
            url: currentUrl + url,
            params: params,
            data: data,
            precision: 'ms',
            inspect: { type: 'influxdb' },
            paramSerializer: this.serializeParams,
        };
        req.headers = req.headers || {};
        if (this.basicAuth || this.withCredentials) {
            req.withCredentials = true;
        }
        if (this.basicAuth) {
            req.headers.Authorization = this.basicAuth;
        }
        if (method === 'POST') {
            req.headers['Content-type'] = 'application/x-www-form-urlencoded';
        }
        return getBackendSrv()
            .fetch(req)
            .pipe(map(function (result) {
            var data = result.data;
            if (data) {
                data.executedQueryString = q;
                if (data.results) {
                    var errors = result.data.results.filter(function (elem) { return elem.error; });
                    if (errors.length > 0) {
                        throw {
                            message: 'InfluxDB Error: ' + errors[0].error,
                            data: data,
                        };
                    }
                }
            }
            return data;
        }), catchError(function (err) {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(_this.handleErrors(err));
        }));
    };
    InfluxDatasource.prototype.handleErrors = function (err) {
        var error = {
            message: (err && err.status) ||
                (err && err.message) ||
                'Unknown error during query transaction. Please check JS console logs.',
        };
        if ((Number.isInteger(err.status) && err.status !== 0) || err.status >= 300) {
            if (err.data && err.data.error) {
                error.message = 'InfluxDB Error: ' + err.data.error;
                error.data = err.data;
                // @ts-ignore
                error.config = err.config;
            }
            else {
                error.message = 'Network Error: ' + err.statusText + '(' + err.status + ')';
                error.data = err.data;
                // @ts-ignore
                error.config = err.config;
            }
        }
        return error;
    };
    InfluxDatasource.prototype.getTimeFilter = function (options) {
        var from = this.getInfluxTime(options.rangeRaw.from, false, options.timezone);
        var until = this.getInfluxTime(options.rangeRaw.to, true, options.timezone);
        return 'time >= ' + from + ' and time <= ' + until;
    };
    InfluxDatasource.prototype.getInfluxTime = function (date, roundUp, timezone) {
        if (isString(date)) {
            if (date === 'now') {
                return 'now()';
            }
            var parts = /^now-(\d+)([dhms])$/.exec(date);
            if (parts) {
                var amount = parseInt(parts[1], 10);
                var unit = parts[2];
                return 'now() - ' + amount + unit;
            }
            date = dateMath.parse(date, roundUp, timezone);
        }
        return date.valueOf() + 'ms';
    };
    return InfluxDatasource;
}(DataSourceWithBackend));
export default InfluxDatasource;
//# sourceMappingURL=datasource.js.map