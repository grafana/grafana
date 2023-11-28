import { __awaiter, __rest } from "tslib";
import { cloneDeep, extend, groupBy, has, isString, map as _map, omit, pick, reduce } from 'lodash';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { dateMath, escapeRegex, FieldType, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, toDataFrame, } from '@grafana/data';
import { DataSourceWithBackend, frameToMetricFindValue, getBackendSrv, } from '@grafana/runtime';
import config from 'app/core/config';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { AnnotationEditor } from './components/editor/annotation/AnnotationEditor';
import { FluxQueryEditor } from './components/editor/query/flux/FluxQueryEditor';
import { BROWSER_MODE_DISABLED_MESSAGE } from './constants';
import { toRawSql } from './fsql/sqlUtil';
import InfluxQueryModel from './influx_query_model';
import InfluxSeries from './influx_series';
import { buildMetadataQuery } from './influxql_query_builder';
import { prepareAnnotation } from './migrations';
import { buildRawQuery } from './queryUtils';
import ResponseParser from './response_parser';
import { DEFAULT_POLICY, InfluxVersion } from './types';
export default class InfluxDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        var _a, _b, _c, _d, _e, _f;
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.type = 'influxdb';
        this.urls = ((_a = instanceSettings.url) !== null && _a !== void 0 ? _a : '').split(',').map((url) => {
            return url.trim();
        });
        this.username = (_b = instanceSettings.username) !== null && _b !== void 0 ? _b : '';
        this.password = (_c = instanceSettings.password) !== null && _c !== void 0 ? _c : '';
        this.name = instanceSettings.name;
        this.basicAuth = instanceSettings.basicAuth;
        this.withCredentials = instanceSettings.withCredentials;
        this.access = instanceSettings.access;
        const settingsData = (_d = instanceSettings.jsonData) !== null && _d !== void 0 ? _d : {};
        this.database = (_e = settingsData.dbName) !== null && _e !== void 0 ? _e : instanceSettings.database;
        this.interval = settingsData.timeInterval;
        this.httpMode = settingsData.httpMode || 'GET';
        this.responseParser = new ResponseParser();
        this.version = (_f = settingsData.version) !== null && _f !== void 0 ? _f : InfluxVersion.InfluxQL;
        this.isProxyAccess = instanceSettings.access === 'proxy';
        if (this.version === InfluxVersion.Flux) {
            // When flux, use an annotation processor rather than the `annotationQuery` lifecycle
            this.annotations = {
                QueryEditor: FluxQueryEditor,
            };
        }
        else {
            this.annotations = {
                QueryEditor: AnnotationEditor,
                prepareAnnotation,
            };
        }
    }
    query(request) {
        if (!this.isProxyAccess) {
            const error = new Error(BROWSER_MODE_DISABLED_MESSAGE);
            return throwError(() => error);
        }
        return this._query(request);
    }
    _query(request) {
        // for not-flux queries we call `this.classicQuery`, and that
        // handles the is-hidden situation.
        // for the flux-case, we do the filtering here
        const filteredRequest = Object.assign(Object.assign({}, request), { targets: request.targets.filter((t) => t.hide !== true) });
        // migrate annotations
        if (filteredRequest.targets.some((target) => target.fromAnnotations)) {
            const streams = [];
            for (const target of filteredRequest.targets) {
                if (target.query) {
                    streams.push(new Observable((subscriber) => {
                        this.annotationEvents(filteredRequest, target)
                            .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
                            .catch((ex) => subscriber.error(new Error(ex)))
                            .finally(() => subscriber.complete());
                    }));
                }
            }
            return merge(...streams);
        }
        if (this.version === InfluxVersion.Flux || this.version === InfluxVersion.SQL) {
            return super.query(filteredRequest);
        }
        if (this.isMigrationToggleOnAndIsAccessProxy()) {
            return super.query(filteredRequest).pipe(map((res) => {
                if (res.error) {
                    throw {
                        message: 'InfluxDB Error: ' + res.error.message,
                        res,
                    };
                }
                const groupedFrames = groupBy(res.data, (x) => x.refId);
                if (Object.keys(groupedFrames).length === 0) {
                    return { data: [] };
                }
                const seriesList = [];
                filteredRequest.targets.forEach((target) => {
                    var _a;
                    const filteredFrames = (_a = groupedFrames[target.refId]) !== null && _a !== void 0 ? _a : [];
                    switch (target.resultFormat) {
                        case 'logs':
                        case 'table':
                            seriesList.push(this.responseParser.getTable(filteredFrames, target, {
                                preferredVisualisationType: target.resultFormat,
                            }));
                            break;
                        default: {
                            for (let i = 0; i < filteredFrames.length; i++) {
                                seriesList.push(filteredFrames[i]);
                            }
                            break;
                        }
                    }
                });
                return { data: seriesList };
            }));
        }
        // Fallback to classic query support
        return this.classicQuery(request);
    }
    getQueryDisplayText(query) {
        switch (this.version) {
            case InfluxVersion.Flux:
                return query.query;
            case InfluxVersion.SQL:
                return toRawSql(query);
            case InfluxVersion.InfluxQL:
                return new InfluxQueryModel(query).render(false);
            default:
                return '';
        }
    }
    /**
     * Returns false if the query should be skipped
     */
    filterQuery(query) {
        if (this.version === InfluxVersion.Flux) {
            return !!query.query;
        }
        return true;
    }
    applyTemplateVariables(query, scopedVars) {
        var _a, _b, _c, _d;
        // We want to interpolate these variables on backend
        const _e = scopedVars || {}, { __interval, __interval_ms } = _e, rest = __rest(_e, ["__interval", "__interval_ms"]);
        if (this.version === InfluxVersion.Flux) {
            return Object.assign(Object.assign({}, query), { query: this.templateSrv.replace((_a = query.query) !== null && _a !== void 0 ? _a : '', rest) });
        }
        if (this.isMigrationToggleOnAndIsAccessProxy()) {
            query = this.applyVariables(query, rest);
            if ((_b = query.adhocFilters) === null || _b === void 0 ? void 0 : _b.length) {
                const adhocFiltersToTags = ((_c = query.adhocFilters) !== null && _c !== void 0 ? _c : []).map((af) => {
                    const { condition } = af, asTag = __rest(af, ["condition"]);
                    return asTag;
                });
                query.tags = [...((_d = query.tags) !== null && _d !== void 0 ? _d : []), ...adhocFiltersToTags];
            }
        }
        return query;
    }
    targetContainsTemplate(target) {
        // for flux-mode we just take target.query,
        // for influxql-mode we use InfluxQueryModel to create the text-representation
        const queryText = this.version === InfluxVersion.Flux ? target.query : buildRawQuery(target);
        return this.templateSrv.containsTemplate(queryText);
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        if (!queries || queries.length === 0) {
            return [];
        }
        return queries.map((query) => {
            var _a;
            if (this.version === InfluxVersion.Flux) {
                return Object.assign(Object.assign({}, query), { datasource: this.getRef(), query: this.templateSrv.replace((_a = query.query) !== null && _a !== void 0 ? _a : '', scopedVars, this.interpolateQueryExpr) });
            }
            return Object.assign(Object.assign(Object.assign({}, query), { datasource: this.getRef() }), this.applyVariables(query, scopedVars));
        });
    }
    applyVariables(query, scopedVars) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const expandedQuery = Object.assign({}, query);
        if (query.groupBy) {
            expandedQuery.groupBy = query.groupBy.map((groupBy) => {
                var _a;
                return Object.assign(Object.assign({}, groupBy), { params: (_a = groupBy.params) === null || _a === void 0 ? void 0 : _a.map((param) => {
                        return this.templateSrv.replace(param.toString(), undefined, this.interpolateQueryExpr);
                    }) });
            });
        }
        if (query.select) {
            expandedQuery.select = query.select.map((selects) => {
                return selects.map((select) => {
                    var _a;
                    return Object.assign(Object.assign({}, select), { params: (_a = select.params) === null || _a === void 0 ? void 0 : _a.map((param) => {
                            return this.templateSrv.replace(param.toString(), undefined, this.interpolateQueryExpr);
                        }) });
                });
            });
        }
        if (query.tags) {
            expandedQuery.tags = query.tags.map((tag) => {
                return Object.assign(Object.assign({}, tag), { value: this.templateSrv.replace(tag.value, scopedVars, this.interpolateQueryExpr) });
            });
        }
        return Object.assign(Object.assign({}, expandedQuery), { adhocFilters: (_a = this.templateSrv.getAdhocFilters(this.name)) !== null && _a !== void 0 ? _a : [], query: this.templateSrv.replace((_b = query.query) !== null && _b !== void 0 ? _b : '', scopedVars, this.interpolateQueryExpr), alias: this.templateSrv.replace((_c = query.alias) !== null && _c !== void 0 ? _c : '', scopedVars), limit: this.templateSrv.replace((_e = (_d = query.limit) === null || _d === void 0 ? void 0 : _d.toString()) !== null && _e !== void 0 ? _e : '', scopedVars, this.interpolateQueryExpr), measurement: this.templateSrv.replace((_f = query.measurement) !== null && _f !== void 0 ? _f : '', scopedVars, this.interpolateQueryExpr), policy: this.templateSrv.replace((_g = query.policy) !== null && _g !== void 0 ? _g : '', scopedVars, this.interpolateQueryExpr), slimit: this.templateSrv.replace((_j = (_h = query.slimit) === null || _h === void 0 ? void 0 : _h.toString()) !== null && _j !== void 0 ? _j : '', scopedVars, this.interpolateQueryExpr), tz: this.templateSrv.replace((_k = query.tz) !== null && _k !== void 0 ? _k : '', scopedVars) });
    }
    interpolateQueryExpr(value = [], variable) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return influxRegularEscape(value);
        }
        if (typeof value === 'string') {
            return influxSpecialRegexEscape(value);
        }
        const escapedValues = value.map((val) => influxSpecialRegexEscape(val));
        if (escapedValues.length === 1) {
            return escapedValues[0];
        }
        return escapedValues.join('|');
    }
    runMetadataQuery(target) {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return lastValueFrom(_super.query.call(this, {
                targets: [target],
            })).then((rsp) => {
                var _a;
                if ((_a = rsp.data) === null || _a === void 0 ? void 0 : _a.length) {
                    return frameToMetricFindValue(rsp.data[0]);
                }
                return [];
            });
        });
    }
    metricFindQuery(query, options) {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            if (this.version === InfluxVersion.Flux || this.isMigrationToggleOnAndIsAccessProxy()) {
                const target = {
                    refId: 'metricFindQuery',
                    query,
                    rawQuery: true,
                };
                return lastValueFrom(_super.query.call(this, Object.assign(Object.assign({}, options), { targets: [target] }))).then((rsp) => {
                    var _a;
                    if ((_a = rsp.data) === null || _a === void 0 ? void 0 : _a.length) {
                        return frameToMetricFindValue(rsp.data[0]);
                    }
                    return [];
                });
            }
            const interpolated = this.templateSrv.replace(query, options.scopedVars, this.interpolateQueryExpr);
            return lastValueFrom(this._seriesQuery(interpolated, options)).then((resp) => {
                return this.responseParser.parse(query, resp);
            });
        });
    }
    // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
    // Used in public/app/features/variables/adhoc/picker/AdHocFilterKey.tsx::fetchFilterKeys
    getTagKeys(options) {
        const query = buildMetadataQuery({
            type: 'TAG_KEYS',
            templateService: this.templateSrv,
            database: this.database,
        });
        return this.metricFindQuery(query);
    }
    getTagValues(options) {
        const query = buildMetadataQuery({
            type: 'TAG_VALUES',
            templateService: this.templateSrv,
            database: this.database,
            withKey: options.key,
        });
        return this.metricFindQuery(query);
    }
    /**
     * @deprecated
     */
    _seriesQuery(query, options) {
        if (!query) {
            return of({ results: [] });
        }
        if (options && options.range) {
            const timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
            query = query.replace('$timeFilter', timeFilter);
        }
        return this._influxRequest(this.httpMode, '/query', { q: query, epoch: 'ms' }, options);
    }
    /**
     * @deprecated
     */
    serializeParams(params) {
        if (!params) {
            return '';
        }
        return reduce(params, (memo, value, key) => {
            if (value === null || value === undefined) {
                return memo;
            }
            memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            return memo;
        }, []).join('&');
    }
    /**
     * @deprecated
     */
    _influxRequest(method, url, data, options) {
        const currentUrl = this.urls.shift();
        this.urls.push(currentUrl);
        const params = {};
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
        if ((options === null || options === void 0 ? void 0 : options.policy) && options.policy !== DEFAULT_POLICY) {
            params.rp = options.policy;
        }
        const { q } = data;
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
        const req = {
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
            .pipe(map((result) => {
            const { data } = result;
            if (data) {
                data.executedQueryString = q;
                if (data.results) {
                    const errors = result.data.results.filter((elem) => elem.error);
                    if (errors.length > 0) {
                        throw {
                            message: 'InfluxDB Error: ' + errors[0].error,
                            data,
                        };
                    }
                }
            }
            return data;
        }), catchError((err) => {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(this.handleErrors(err));
        }));
    }
    /**
     * @deprecated
     */
    handleErrors(err) {
        const error = {
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
    }
    getTimeFilter(options) {
        const from = this.getInfluxTime(options.rangeRaw.from, false, options.timezone);
        const until = this.getInfluxTime(options.rangeRaw.to, true, options.timezone);
        return 'time >= ' + from + ' and time <= ' + until;
    }
    getInfluxTime(date, roundUp, timezone) {
        let outPutDate;
        if (isString(date)) {
            if (date === 'now') {
                return 'now()';
            }
            const parts = /^now-(\d+)([dhms])$/.exec(date);
            if (parts) {
                const amount = parseInt(parts[1], 10);
                const unit = parts[2];
                return 'now() - ' + amount + unit;
            }
            outPutDate = dateMath.parse(date, roundUp, timezone);
            if (!outPutDate) {
                throw new Error('unable to parse date');
            }
            date = outPutDate;
        }
        return date.valueOf() + 'ms';
    }
    // ------------------------ Legacy Code - Before Backend Migration ---------------
    isMigrationToggleOnAndIsAccessProxy() {
        return config.featureToggles.influxdbBackendMigration && this.access === 'proxy';
    }
    /**
     * The unchanged pre 7.1 query implementation
     * @deprecated
     */
    classicQuery(options) {
        let timeFilter = this.getTimeFilter(options);
        const scopedVars = options.scopedVars;
        const targets = cloneDeep(options.targets);
        const queryTargets = [];
        let i, y;
        let allQueries = _map(targets, (target) => {
            if (target.hide) {
                return '';
            }
            queryTargets.push(target);
            // backward compatibility
            scopedVars.interval = scopedVars.__interval;
            return new InfluxQueryModel(target, this.templateSrv, scopedVars).render(true);
        }).reduce((acc, current) => {
            if (current !== '') {
                acc += ';' + current;
            }
            return acc;
        });
        if (allQueries === '') {
            return of({ data: [] });
        }
        // add global adhoc filters to timeFilter
        const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        const adhocFiltersFromDashboard = options.targets.flatMap((target) => { var _a; return (_a = target.adhocFilters) !== null && _a !== void 0 ? _a : []; });
        if ((adhocFilters === null || adhocFilters === void 0 ? void 0 : adhocFilters.length) || (adhocFiltersFromDashboard === null || adhocFiltersFromDashboard === void 0 ? void 0 : adhocFiltersFromDashboard.length)) {
            const ahFilters = (adhocFilters === null || adhocFilters === void 0 ? void 0 : adhocFilters.length) ? adhocFilters : adhocFiltersFromDashboard;
            const tmpQuery = new InfluxQueryModel({ refId: 'A' }, this.templateSrv, scopedVars);
            timeFilter += ' AND ' + tmpQuery.renderAdhocFilters(ahFilters);
        }
        // replace grafana variables
        scopedVars.timeFilter = { value: timeFilter };
        // replace templated variables
        allQueries = this.templateSrv.replace(allQueries, scopedVars);
        return this._seriesQuery(allQueries, options).pipe(map((data) => {
            if (!data || !data.results) {
                return { data: [] };
            }
            const seriesList = [];
            for (i = 0; i < data.results.length; i++) {
                const result = data.results[i];
                if (!result || !result.series) {
                    continue;
                }
                const target = queryTargets[i];
                let alias = target.alias;
                if (alias) {
                    alias = this.templateSrv.replace(target.alias, options.scopedVars);
                }
                const meta = {
                    executedQueryString: data.executedQueryString,
                };
                const influxSeries = new InfluxSeries({
                    refId: target.refId,
                    series: data.results[i].series,
                    alias: alias,
                    meta,
                });
                switch (target.resultFormat) {
                    case 'logs':
                        meta.preferredVisualisationType = 'logs';
                    case 'table': {
                        seriesList.push(influxSeries.getTable());
                        break;
                    }
                    default: {
                        const timeSeries = influxSeries.getTimeSeries();
                        for (y = 0; y < timeSeries.length; y++) {
                            seriesList.push(timeSeriesToDataFrame(timeSeries[y]));
                        }
                        break;
                    }
                }
            }
            return { data: seriesList };
        }));
    }
    annotationEvents(options, annotation) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.version === InfluxVersion.Flux) {
                return Promise.reject({
                    message: 'Flux requires the standard annotation query',
                });
            }
            // InfluxQL puts a query string on the annotation
            if (!annotation.query) {
                return Promise.reject({
                    message: 'Query missing in annotation definition',
                });
            }
            if (this.isMigrationToggleOnAndIsAccessProxy()) {
                // We want to send our query to the backend as a raw query
                const target = {
                    refId: 'metricFindQuery',
                    datasource: this.getRef(),
                    query: this.templateSrv.replace(annotation.query, undefined, this.interpolateQueryExpr),
                    rawQuery: true,
                };
                return lastValueFrom(getBackendSrv()
                    .fetch({
                    url: '/api/ds/query',
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                    data: {
                        from: options.range.from.valueOf().toString(),
                        to: options.range.to.valueOf().toString(),
                        queries: [target],
                    },
                    requestId: annotation.name,
                })
                    .pipe(map((res) => __awaiter(this, void 0, void 0, function* () { return yield this.responseParser.transformAnnotationResponse(annotation, res, target); }))));
            }
            const timeFilter = this.getTimeFilter({ rangeRaw: options.range.raw, timezone: options.timezone });
            let query = annotation.query.replace('$timeFilter', timeFilter);
            query = this.templateSrv.replace(query, undefined, this.interpolateQueryExpr);
            return lastValueFrom(this._seriesQuery(query, options)).then((data) => {
                if (!data || !data.results || !data.results[0]) {
                    throw { message: 'No results in response from InfluxDB' };
                }
                return new InfluxSeries({
                    series: data.results[0].series,
                    annotation: annotation,
                }).getAnnotations();
            });
        });
    }
}
// we detect the field type based on the value-array
function getFieldType(values) {
    // the values-array may contain a lot of nulls.
    // we need the first not-null item
    const firstNotNull = values.find((v) => v !== null);
    if (firstNotNull === undefined) {
        // we could not find any not-null values
        return FieldType.number;
    }
    const valueType = typeof firstNotNull;
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
            throw new Error(`InfluxQL: invalid value type ${valueType}`);
    }
}
// this conversion function is specialized to work with the timeseries
// data returned by InfluxDatasource.getTimeSeries()
function timeSeriesToDataFrame(timeSeries) {
    const times = [];
    const values = [];
    // the data we process here is not correctly typed.
    // the typescript types say every data-point is number|null,
    // but in fact it can be string or boolean too.
    const points = timeSeries.datapoints;
    for (const point of points) {
        values.push(point[0]);
        times.push(point[1]);
    }
    const timeField = {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: times,
    };
    const valueField = {
        name: TIME_SERIES_VALUE_FIELD_NAME,
        type: getFieldType(values),
        config: {
            displayNameFromDS: timeSeries.title,
        },
        values: values,
        labels: timeSeries.tags,
    };
    const fields = [timeField, valueField];
    return {
        name: timeSeries.target,
        refId: timeSeries.refId,
        meta: timeSeries.meta,
        fields,
        length: values.length,
    };
}
export function influxRegularEscape(value) {
    if (typeof value === 'string') {
        // Check the value is a number. If not run to escape special characters
        if (isNaN(parseFloat(value))) {
            return escapeRegex(value);
        }
    }
    return value;
}
export function influxSpecialRegexEscape(value) {
    return typeof value === 'string' ? value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&') : value;
}
//# sourceMappingURL=datasource.js.map