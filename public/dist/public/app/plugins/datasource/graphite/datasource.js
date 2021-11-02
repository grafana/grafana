import { __assign, __extends } from "tslib";
import { each, indexOf, isArray, isString, map as _map } from 'lodash';
import { lastValueFrom, of, pipe, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import { DataSourceApi, dateMath, toDataFrame, } from '@grafana/data';
import { isVersionGtOrEq, SemVersion } from 'app/core/utils/version';
import gfunc from './gfunc';
import { getTemplateSrv } from 'app/features/templating/template_srv';
// Types
import { GraphiteType, } from './types';
import { getRollupNotice, getRuntimeConsolidationNotice } from 'app/plugins/datasource/graphite/meta';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';
import { DEFAULT_GRAPHITE_VERSION } from './versions';
import { reduceError } from './utils';
var GraphiteDatasource = /** @class */ (function (_super) {
    __extends(GraphiteDatasource, _super);
    function GraphiteDatasource(instanceSettings, templateSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _a, _b;
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.funcDefs = null;
        _this.funcDefsPromise = null;
        _this.convertResponseToDataFrames = function (result) {
            var data = [];
            if (!result || !result.data) {
                return { data: data };
            }
            // Series are either at the root or under a node called 'series'
            var series = result.data.series || result.data;
            if (!isArray(series)) {
                throw { message: 'Missing series in result', data: result };
            }
            for (var i = 0; i < series.length; i++) {
                var s = series[i];
                // Disables Grafana own series naming
                s.title = s.target;
                for (var y = 0; y < s.datapoints.length; y++) {
                    s.datapoints[y][1] *= 1000;
                }
                var frame = toDataFrame(s);
                // Metrictank metadata
                if (s.meta) {
                    frame.meta = {
                        custom: {
                            requestMetaList: result.data.meta,
                            seriesMetaList: s.meta, // Array of metadata
                        },
                    };
                    if (_this.rollupIndicatorEnabled) {
                        var rollupNotice = getRollupNotice(s.meta);
                        var runtimeNotice = getRuntimeConsolidationNotice(s.meta);
                        if (rollupNotice) {
                            frame.meta.notices = [rollupNotice];
                        }
                        else if (runtimeNotice) {
                            frame.meta.notices = [runtimeNotice];
                        }
                    }
                    // only add the request stats to the first frame
                    if (i === 0 && result.data.meta.stats) {
                        frame.meta.stats = _this.getRequestStats(result.data.meta);
                    }
                }
                data.push(frame);
            }
            return { data: data };
        };
        _this.basicAuth = instanceSettings.basicAuth;
        _this.url = instanceSettings.url;
        _this.name = instanceSettings.name;
        // graphiteVersion is set when a datasource is created but it hadn't been set in the past so we're
        // still falling back to the default behavior here for backwards compatibility (see also #17429)
        _this.graphiteVersion = instanceSettings.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
        _this.metricMappings = ((_b = (_a = instanceSettings.jsonData.importConfiguration) === null || _a === void 0 ? void 0 : _a.loki) === null || _b === void 0 ? void 0 : _b.mappings) || [];
        _this.isMetricTank = instanceSettings.jsonData.graphiteType === GraphiteType.Metrictank;
        _this.supportsTags = supportsTags(_this.graphiteVersion);
        _this.cacheTimeout = instanceSettings.cacheTimeout;
        _this.rollupIndicatorEnabled = instanceSettings.jsonData.rollupIndicatorEnabled;
        _this.withCredentials = instanceSettings.withCredentials;
        _this.funcDefs = null;
        _this.funcDefsPromise = null;
        _this._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return _this;
    }
    GraphiteDatasource.prototype.getQueryOptionsInfo = function () {
        return {
            maxDataPoints: true,
            cacheTimeout: true,
            links: [
                {
                    text: 'Help',
                    url: 'http://docs.grafana.org/features/datasources/graphite/#using-graphite-in-grafana',
                },
            ],
        };
    };
    GraphiteDatasource.prototype.getImportQueryConfiguration = function () {
        return {
            loki: {
                mappings: this.metricMappings,
            },
        };
    };
    GraphiteDatasource.prototype.query = function (options) {
        var graphOptions = {
            from: this.translateTime(options.range.raw.from, false, options.timezone),
            until: this.translateTime(options.range.raw.to, true, options.timezone),
            targets: options.targets,
            format: options.format,
            cacheTimeout: options.cacheTimeout || this.cacheTimeout,
            maxDataPoints: options.maxDataPoints,
        };
        var params = this.buildGraphiteParams(graphOptions, options.scopedVars);
        if (params.length === 0) {
            return of({ data: [] });
        }
        if (this.isMetricTank) {
            params.push('meta=true');
        }
        var httpOptions = {
            method: 'POST',
            url: '/render',
            data: params.join('&'),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        this.addTracingHeaders(httpOptions, options);
        if (options.panelId) {
            httpOptions.requestId = this.name + '.panelId.' + options.panelId;
        }
        return this.doGraphiteRequest(httpOptions).pipe(map(this.convertResponseToDataFrames));
    };
    GraphiteDatasource.prototype.addTracingHeaders = function (httpOptions, options) {
        var proxyMode = !this.url.match(/^http/);
        if (proxyMode) {
            if (options.dashboardId) {
                httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
            }
            if (options.panelId) {
                httpOptions.headers['X-Panel-Id'] = options.panelId;
            }
        }
    };
    GraphiteDatasource.prototype.getRequestStats = function (meta) {
        var stats = [];
        for (var key in meta.stats) {
            var unit = undefined;
            if (key.endsWith('.ms')) {
                unit = 'ms';
            }
            stats.push({ displayName: key, value: meta.stats[key], unit: unit });
        }
        return stats;
    };
    GraphiteDatasource.prototype.parseTags = function (tagString) {
        var tags = [];
        tags = tagString.split(',');
        if (tags.length === 1) {
            tags = tagString.split(' ');
            if (tags[0] === '') {
                tags = [];
            }
        }
        return tags;
    };
    GraphiteDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        var expandedQueries = queries;
        if (queries && queries.length > 0) {
            expandedQueries = queries.map(function (query) {
                var _a;
                var expandedQuery = __assign(__assign({}, query), { datasource: _this.getRef(), target: _this.templateSrv.replace((_a = query.target) !== null && _a !== void 0 ? _a : '', scopedVars) });
                return expandedQuery;
            });
        }
        return expandedQueries;
    };
    GraphiteDatasource.prototype.annotationQuery = function (options) {
        var _this = this;
        // Graphite metric as annotation
        if (options.annotation.target) {
            var target = this.templateSrv.replace(options.annotation.target, {}, 'glob');
            var graphiteQuery = {
                range: options.range,
                targets: [{ target: target }],
                format: 'json',
                maxDataPoints: 100,
            };
            return lastValueFrom(this.query(graphiteQuery).pipe(map(function (result) {
                var list = [];
                for (var i = 0; i < result.data.length; i++) {
                    var target_1 = result.data[i];
                    for (var y = 0; y < target_1.length; y++) {
                        var time = target_1.fields[0].values.get(y);
                        var value = target_1.fields[1].values.get(y);
                        if (!value) {
                            continue;
                        }
                        list.push({
                            annotation: options.annotation,
                            time: time,
                            title: target_1.name,
                        });
                    }
                }
                return list;
            })));
        }
        else {
            // Graphite event as annotation
            var tags = this.templateSrv.replace(options.annotation.tags);
            return this.events({ range: options.range, tags: tags }).then(function (results) {
                var list = [];
                if (!isArray(results.data)) {
                    console.error("Unable to get annotations from " + results.url + ".");
                    return [];
                }
                for (var i = 0; i < results.data.length; i++) {
                    var e = results.data[i];
                    var tags_1 = e.tags;
                    if (isString(e.tags)) {
                        tags_1 = _this.parseTags(e.tags);
                    }
                    list.push({
                        annotation: options.annotation,
                        time: e.when * 1000,
                        title: e.what,
                        tags: tags_1,
                        text: e.data,
                    });
                }
                return list;
            });
        }
    };
    GraphiteDatasource.prototype.events = function (options) {
        try {
            var tags = '';
            if (options.tags) {
                tags = '&tags=' + options.tags;
            }
            return lastValueFrom(this.doGraphiteRequest({
                method: 'GET',
                url: '/events/get_data?from=' +
                    this.translateTime(options.range.raw.from, false, options.timezone) +
                    '&until=' +
                    this.translateTime(options.range.raw.to, true, options.timezone) +
                    tags,
            }));
        }
        catch (err) {
            return Promise.reject(err);
        }
    };
    GraphiteDatasource.prototype.targetContainsTemplate = function (target) {
        var _a;
        return this.templateSrv.variableExists((_a = target.target) !== null && _a !== void 0 ? _a : '');
    };
    GraphiteDatasource.prototype.translateTime = function (date, roundUp, timezone) {
        if (isString(date)) {
            if (date === 'now') {
                return 'now';
            }
            else if (date.indexOf('now-') >= 0 && date.indexOf('/') === -1) {
                date = date.substring(3);
                date = date.replace('m', 'min');
                date = date.replace('M', 'mon');
                return date;
            }
            date = dateMath.parse(date, roundUp, timezone);
        }
        // graphite' s from filter is exclusive
        // here we step back one minute in order
        // to guarantee that we get all the data that
        // exists for the specified range
        if (roundUp) {
            if (date.get('s')) {
                date.add(1, 's');
            }
        }
        else if (roundUp === false) {
            if (date.get('s')) {
                date.subtract(1, 's');
            }
        }
        return date.unix();
    };
    GraphiteDatasource.prototype.metricFindQuery = function (query, optionalOptions) {
        var options = optionalOptions || {};
        // First attempt to check for tag-related functions (using empty wildcard for interpolation)
        var interpolatedQuery = this.templateSrv.replace(query, getSearchFilterScopedVar({ query: query, wildcardChar: '', options: optionalOptions }));
        // special handling for tag_values(<tag>[,<expression>]*), this is used for template variables
        var allParams = interpolatedQuery.match(/^tag_values\((.*)\)$/);
        var expressions = allParams ? allParams[1].split(',').filter(function (p) { return !!p; }) : undefined;
        if (expressions) {
            options.limit = 10000;
            return this.getTagValuesAutoComplete(expressions.slice(1), expressions[0], undefined, options);
        }
        // special handling for tags(<expression>[,<expression>]*), this is used for template variables
        allParams = interpolatedQuery.match(/^tags\((.*)\)$/);
        expressions = allParams ? allParams[1].split(',').filter(function (p) { return !!p; }) : undefined;
        if (expressions) {
            options.limit = 10000;
            return this.getTagsAutoComplete(expressions, undefined, options);
        }
        // If no tag-related query was found, perform metric-based search (using * as the wildcard for interpolation)
        var useExpand = query.match(/^expand\((.*)\)$/);
        query = useExpand ? useExpand[1] : query;
        interpolatedQuery = this.templateSrv.replace(query, getSearchFilterScopedVar({ query: query, wildcardChar: '*', options: optionalOptions }));
        var range;
        if (options.range) {
            range = {
                from: this.translateTime(options.range.from, false, options.timezone),
                until: this.translateTime(options.range.to, true, options.timezone),
            };
        }
        if (useExpand) {
            return this.requestMetricExpand(interpolatedQuery, options.requestId, range);
        }
        else {
            return this.requestMetricFind(interpolatedQuery, options.requestId, range);
        }
    };
    /**
     * Search for metrics matching giving pattern using /metrics/find endpoint. It will
     * return all possible values at the last level of the query, for example:
     *
     * metrics: prod.servers.001.cpu, prod.servers.002.cpu
     * query: *.servers.*
     * result: 001, 002
     *
     * For more complex searches use requestMetricExpand
     */
    GraphiteDatasource.prototype.requestMetricFind = function (query, requestId, range) {
        var httpOptions = {
            method: 'POST',
            url: '/metrics/find',
            params: {},
            data: "query=" + query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            // for cancellations
            requestId: requestId,
        };
        if (range) {
            httpOptions.params.from = range.from;
            httpOptions.params.until = range.until;
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            return _map(results.data, function (metric) {
                return {
                    text: metric.text,
                    expandable: metric.expandable ? true : false,
                };
            });
        })));
    };
    /**
     * Search for metrics matching giving pattern using /metrics/expand endpoint.
     * The result will contain all metrics (with full name) matching provided query.
     * It's a more flexible version of /metrics/find endpoint (@see requestMetricFind)
     */
    GraphiteDatasource.prototype.requestMetricExpand = function (query, requestId, range) {
        var httpOptions = {
            method: 'GET',
            url: '/metrics/expand',
            params: { query: query },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            // for cancellations
            requestId: requestId,
        };
        if (range) {
            httpOptions.params.from = range.from;
            httpOptions.params.until = range.until;
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            return _map(results.data.results, function (metric) {
                return {
                    text: metric,
                    expandable: false,
                };
            });
        })));
    };
    GraphiteDatasource.prototype.getTags = function (optionalOptions) {
        var options = optionalOptions || {};
        var httpOptions = {
            method: 'GET',
            url: '/tags',
            // for cancellations
            requestId: options.requestId,
        };
        if (options.range) {
            httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
            httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            return _map(results.data, function (tag) {
                return {
                    text: tag.tag,
                    id: tag.id,
                };
            });
        })));
    };
    GraphiteDatasource.prototype.getTagValues = function (options) {
        if (options === void 0) { options = {}; }
        var httpOptions = {
            method: 'GET',
            url: '/tags/' + this.templateSrv.replace(options.key),
            // for cancellations
            requestId: options.requestId,
        };
        if (options.range) {
            httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
            httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            if (results.data && results.data.values) {
                return _map(results.data.values, function (value) {
                    return {
                        text: value.value,
                        id: value.id,
                    };
                });
            }
            else {
                return [];
            }
        })));
    };
    GraphiteDatasource.prototype.getTagsAutoComplete = function (expressions, tagPrefix, optionalOptions) {
        var _this = this;
        var options = optionalOptions || {};
        var httpOptions = {
            method: 'GET',
            url: '/tags/autoComplete/tags',
            params: {
                expr: _map(expressions, function (expression) { return _this.templateSrv.replace((expression || '').trim()); }),
            },
            // for cancellations
            requestId: options.requestId,
        };
        if (tagPrefix) {
            httpOptions.params.tagPrefix = tagPrefix;
        }
        if (options.limit) {
            httpOptions.params.limit = options.limit;
        }
        if (options.range) {
            httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
            httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(mapToTags()));
    };
    GraphiteDatasource.prototype.getTagValuesAutoComplete = function (expressions, tag, valuePrefix, optionalOptions) {
        var _this = this;
        var options = optionalOptions || {};
        var httpOptions = {
            method: 'GET',
            url: '/tags/autoComplete/values',
            params: {
                expr: _map(expressions, function (expression) { return _this.templateSrv.replace((expression || '').trim()); }),
                tag: this.templateSrv.replace((tag || '').trim()),
            },
            // for cancellations
            requestId: options.requestId,
        };
        if (valuePrefix) {
            httpOptions.params.valuePrefix = valuePrefix;
        }
        if (options.limit) {
            httpOptions.params.limit = options.limit;
        }
        if (options.range) {
            httpOptions.params.from = this.translateTime(options.range.from, false, options.timezone);
            httpOptions.params.until = this.translateTime(options.range.to, true, options.timezone);
        }
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(mapToTags()));
    };
    GraphiteDatasource.prototype.getVersion = function (optionalOptions) {
        var options = optionalOptions || {};
        var httpOptions = {
            method: 'GET',
            url: '/version',
            requestId: options.requestId,
        };
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            if (results.data) {
                var semver = new SemVersion(results.data);
                return semver.isValid() ? results.data : '';
            }
            return '';
        }), catchError(function () {
            return of('');
        })));
    };
    GraphiteDatasource.prototype.createFuncInstance = function (funcDef, options) {
        return gfunc.createFuncInstance(funcDef, options, this.funcDefs);
    };
    GraphiteDatasource.prototype.getFuncDef = function (name) {
        return gfunc.getFuncDef(name, this.funcDefs);
    };
    GraphiteDatasource.prototype.waitForFuncDefsLoaded = function () {
        return this.getFuncDefs();
    };
    GraphiteDatasource.prototype.getFuncDefs = function () {
        var _this = this;
        if (this.funcDefsPromise !== null) {
            return this.funcDefsPromise;
        }
        if (!supportsFunctionIndex(this.graphiteVersion)) {
            this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
            this.funcDefsPromise = Promise.resolve(this.funcDefs);
            return this.funcDefsPromise;
        }
        var httpOptions = {
            method: 'GET',
            url: '/functions',
        };
        return lastValueFrom(this.doGraphiteRequest(httpOptions).pipe(map(function (results) {
            if (results.status !== 200 || typeof results.data !== 'object') {
                if (typeof results.data === 'string') {
                    // Fix for a Graphite bug: https://github.com/graphite-project/graphite-web/issues/2609
                    // There is a fix for it https://github.com/graphite-project/graphite-web/pull/2612 but
                    // it was merged to master in July 2020 but it has never been released (the last Graphite
                    // release was 1.1.7 - March 2020). The bug was introduced in Graphite 1.1.7, in versions
                    // 1.1.0 - 1.1.6 /functions endpoint returns a valid JSON
                    var fixedData = JSON.parse(results.data.replace(/"default": ?Infinity/g, '"default": 1e9999'));
                    _this.funcDefs = gfunc.parseFuncDefs(fixedData);
                }
                else {
                    _this.funcDefs = gfunc.getFuncDefs(_this.graphiteVersion);
                }
            }
            else {
                _this.funcDefs = gfunc.parseFuncDefs(results.data);
            }
            return _this.funcDefs;
        }), catchError(function (error) {
            console.error('Fetching graphite functions error', error);
            _this.funcDefs = gfunc.getFuncDefs(_this.graphiteVersion);
            return of(_this.funcDefs);
        })));
    };
    GraphiteDatasource.prototype.testDatasource = function () {
        var query = {
            panelId: 3,
            rangeRaw: { from: 'now-1h', to: 'now' },
            range: {
                raw: { from: 'now-1h', to: 'now' },
            },
            targets: [{ target: 'constantLine(100)' }],
            maxDataPoints: 300,
        };
        return lastValueFrom(this.query(query)).then(function () { return ({ status: 'success', message: 'Data source is working' }); });
    };
    GraphiteDatasource.prototype.doGraphiteRequest = function (options) {
        if (this.basicAuth || this.withCredentials) {
            options.withCredentials = true;
        }
        if (this.basicAuth) {
            options.headers = options.headers || {};
            options.headers.Authorization = this.basicAuth;
        }
        options.url = this.url + options.url;
        options.inspect = { type: 'graphite' };
        return getBackendSrv()
            .fetch(options)
            .pipe(catchError(function (err) {
            return throwError(reduceError(err));
        }));
    };
    GraphiteDatasource.prototype.buildGraphiteParams = function (options, scopedVars) {
        var graphiteOptions = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
        var cleanOptions = [], targets = {};
        var target, targetValue, i;
        var regex = /\#([A-Z])/g;
        var intervalFormatFixRegex = /'(\d+)m'/gi;
        var hasTargets = false;
        options['format'] = 'json';
        function fixIntervalFormat(match) {
            return match.replace('m', 'min').replace('M', 'mon');
        }
        for (i = 0; i < options.targets.length; i++) {
            target = options.targets[i];
            if (!target.target) {
                continue;
            }
            if (!target.refId) {
                target.refId = this._seriesRefLetters[i];
            }
            targetValue = this.templateSrv.replace(target.target, scopedVars);
            targetValue = targetValue.replace(intervalFormatFixRegex, fixIntervalFormat);
            targets[target.refId] = targetValue;
        }
        function nestedSeriesRegexReplacer(match, g1) {
            return targets[g1] || match;
        }
        for (i = 0; i < options.targets.length; i++) {
            target = options.targets[i];
            if (!target.target) {
                continue;
            }
            targetValue = targets[target.refId];
            targetValue = targetValue.replace(regex, nestedSeriesRegexReplacer);
            targets[target.refId] = targetValue;
            if (!target.hide) {
                hasTargets = true;
                cleanOptions.push('target=' + encodeURIComponent(targetValue));
            }
        }
        each(options, function (value, key) {
            if (indexOf(graphiteOptions, key) === -1) {
                return;
            }
            if (value) {
                cleanOptions.push(key + '=' + encodeURIComponent(value));
            }
        });
        if (!hasTargets) {
            return [];
        }
        return cleanOptions;
    };
    return GraphiteDatasource;
}(DataSourceApi));
export { GraphiteDatasource };
function supportsTags(version) {
    return isVersionGtOrEq(version, '1.1');
}
function supportsFunctionIndex(version) {
    return isVersionGtOrEq(version, '1.1');
}
function mapToTags() {
    return pipe(map(function (results) {
        if (results.data) {
            return _map(results.data, function (value) {
                return { text: value };
            });
        }
        else {
            return [];
        }
    }));
}
//# sourceMappingURL=datasource.js.map