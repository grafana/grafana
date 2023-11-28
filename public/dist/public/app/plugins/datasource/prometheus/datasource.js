import { __awaiter } from "tslib";
import { cloneDeep, defaults } from 'lodash';
import { forkJoin, lastValueFrom, merge, of, pipe, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import semver from 'semver/preload';
import { CoreApp, dateTime, LoadingState, rangeUtil, renderLegendFormat, } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, isFetchError, toDataQueryResponse, } from '@grafana/runtime';
import { safeStringifyValue } from 'app/core/utils/explore';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { addLabelToQuery } from './add_label_to_query';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import PrometheusLanguageProvider from './language_provider';
import { expandRecordingRules, getClientCacheDurationInMinutes, getPrometheusTime, getRangeSnapInterval, } from './language_utils';
import PrometheusMetricFindQuery from './metric_find_query';
import { getInitHints, getQueryHints } from './query_hints';
import { promQueryModeller } from './querybuilder/PromQueryModeller';
import { defaultPrometheusQueryOverlapWindow, QueryCache } from './querycache/QueryCache';
import { getOriginalMetricName, transform, transformV2 } from './result_transformer';
import { trackQuery } from './tracking';
import { PromApplication, PrometheusCacheLevel, } from './types';
import { PrometheusVariableSupport } from './variables';
const ANNOTATION_QUERY_STEP_DEFAULT = '60s';
const GET_AND_POST_METADATA_ENDPOINTS = ['api/v1/query', 'api/v1/query_range', 'api/v1/series', 'api/v1/labels'];
export const InstantQueryRefIdIndex = '-Instant';
export class PrometheusDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv(), timeSrv = getTimeSrv(), languageProvider) {
        var _a, _b, _c, _d, _e, _f;
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.init = () => __awaiter(this, void 0, void 0, function* () {
            if (!this.disableRecordingRules) {
                this.loadRules();
            }
            this.exemplarsAvailable = yield this.areExemplarsAvailable();
        });
        this.prepareTargets = (options, start, end) => {
            const queries = [];
            const activeTargets = [];
            const clonedTargets = cloneDeep(options.targets);
            for (const target of clonedTargets) {
                if (!target.expr || target.hide) {
                    continue;
                }
                const metricName = this.languageProvider.histogramMetrics.find((m) => target.expr.includes(m));
                // In Explore, we run both (instant and range) queries if both are true (selected) or both are undefined (legacy Explore queries)
                if (options.app === CoreApp.Explore && target.range === target.instant) {
                    // Create instant target
                    const instantTarget = cloneDeep(target);
                    instantTarget.format = 'table';
                    instantTarget.instant = true;
                    instantTarget.range = false;
                    instantTarget.valueWithRefId = true;
                    delete instantTarget.maxDataPoints;
                    // Create range target
                    const rangeTarget = cloneDeep(target);
                    rangeTarget.format = 'time_series';
                    rangeTarget.instant = false;
                    instantTarget.range = true;
                    // Create exemplar query
                    if (target.exemplar) {
                        // Only create exemplar target for different metric names
                        if (!metricName ||
                            (metricName && !activeTargets.some((activeTarget) => activeTarget.expr.includes(metricName)))) {
                            const exemplarTarget = cloneDeep(target);
                            exemplarTarget.instant = false;
                            queries.push(this.createQuery(exemplarTarget, options, start, end));
                            activeTargets.push(exemplarTarget);
                        }
                        instantTarget.exemplar = false;
                        rangeTarget.exemplar = false;
                    }
                    // Add both targets to activeTargets and queries arrays
                    activeTargets.push(instantTarget, rangeTarget);
                    queries.push(this.createQuery(instantTarget, options, start, end), this.createQuery(rangeTarget, options, start, end));
                    // If running only instant query in Explore, format as table
                }
                else if (target.instant && options.app === CoreApp.Explore) {
                    const instantTarget = cloneDeep(target);
                    instantTarget.format = 'table';
                    queries.push(this.createQuery(instantTarget, options, start, end));
                    activeTargets.push(instantTarget);
                }
                else {
                    // It doesn't make sense to query for exemplars in dashboard if only instant is selected
                    if (target.exemplar && !target.instant) {
                        if (!metricName ||
                            (metricName && !activeTargets.some((activeTarget) => activeTarget.expr.includes(metricName)))) {
                            const exemplarTarget = cloneDeep(target);
                            queries.push(this.createQuery(exemplarTarget, options, start, end));
                            activeTargets.push(exemplarTarget);
                        }
                        target.exemplar = false;
                    }
                    queries.push(this.createQuery(target, options, start, end));
                    activeTargets.push(target);
                }
            }
            return {
                queries,
                activeTargets,
            };
        };
        this.handleErrors = (err, target) => {
            const error = {
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
        this.processAnnotationResponse = (options, data) => {
            var _a;
            const frames = toDataQueryResponse({ data: data }).data;
            if (!frames || !frames.length) {
                return [];
            }
            const annotation = options.annotation;
            const { tagKeys = '', titleFormat = '', textFormat = '' } = annotation;
            const step = rangeUtil.intervalToSeconds(annotation.step || ANNOTATION_QUERY_STEP_DEFAULT) * 1000;
            const tagKeysArray = tagKeys.split(',');
            const eventList = [];
            for (const frame of frames) {
                if (frame.fields.length === 0) {
                    continue;
                }
                const timeField = frame.fields[0];
                const valueField = frame.fields[1];
                const labels = (valueField === null || valueField === void 0 ? void 0 : valueField.labels) || {};
                const tags = Object.keys(labels)
                    .filter((label) => tagKeysArray.includes(label))
                    .map((label) => labels[label]);
                const timeValueTuple = [];
                let idx = 0;
                valueField.values.forEach((value) => {
                    let timeStampValue;
                    let valueValue;
                    const time = timeField.values[idx];
                    // If we want to use value as a time, we use value as timeStampValue and valueValue will be 1
                    if (options.annotation.useValueForTime) {
                        timeStampValue = Math.floor(parseFloat(value));
                        valueValue = 1;
                    }
                    else {
                        timeStampValue = Math.floor(parseFloat(time));
                        valueValue = parseFloat(value);
                    }
                    idx++;
                    timeValueTuple.push([timeStampValue, valueValue]);
                });
                const activeValues = timeValueTuple.filter((value) => value[1] > 0);
                const activeValuesTimestamps = activeValues.map((value) => value[0]);
                // Instead of creating singular annotation for each active event we group events into region if they are less
                // or equal to `step` apart.
                let latestEvent = null;
                for (const timestamp of activeValuesTimestamps) {
                    // We already have event `open` and we have new event that is inside the `step` so we just update the end.
                    if (latestEvent && ((_a = latestEvent.timeEnd) !== null && _a !== void 0 ? _a : 0) + step >= timestamp) {
                        latestEvent.timeEnd = timestamp;
                        continue;
                    }
                    // Event exists but new one is outside of the `step` so we add it to eventList.
                    if (latestEvent) {
                        eventList.push(latestEvent);
                    }
                    // We start a new region.
                    latestEvent = {
                        time: timestamp,
                        timeEnd: timestamp,
                        annotation,
                        title: renderLegendFormat(titleFormat, labels),
                        tags,
                        text: renderLegendFormat(textFormat, labels),
                    };
                }
                if (latestEvent) {
                    // Finish up last point if we have one
                    latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
                    eventList.push(latestEvent);
                }
            }
            return eventList;
        };
        this.type = 'prometheus';
        this.id = instanceSettings.id;
        this.url = instanceSettings.url;
        this.access = instanceSettings.access;
        this.basicAuth = instanceSettings.basicAuth;
        this.withCredentials = instanceSettings.withCredentials;
        this.interval = instanceSettings.jsonData.timeInterval || '15s';
        this.queryTimeout = instanceSettings.jsonData.queryTimeout;
        this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
        // `directUrl` is never undefined, we set it at https://github.com/grafana/grafana/blob/main/pkg/api/frontendsettings.go#L108
        // here we "fall back" to this.url to make typescript happy, but it should never happen
        this.directUrl = (_a = instanceSettings.jsonData.directUrl) !== null && _a !== void 0 ? _a : this.url;
        this.exemplarTraceIdDestinations = instanceSettings.jsonData.exemplarTraceIdDestinations;
        this.hasIncrementalQuery = (_b = instanceSettings.jsonData.incrementalQuerying) !== null && _b !== void 0 ? _b : false;
        this.ruleMappings = {};
        this.languageProvider = languageProvider !== null && languageProvider !== void 0 ? languageProvider : new PrometheusLanguageProvider(this);
        this.lookupsDisabled = (_c = instanceSettings.jsonData.disableMetricsLookup) !== null && _c !== void 0 ? _c : false;
        this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
        this.datasourceConfigurationPrometheusFlavor = instanceSettings.jsonData.prometheusType;
        this.datasourceConfigurationPrometheusVersion = instanceSettings.jsonData.prometheusVersion;
        this.defaultEditor = instanceSettings.jsonData.defaultEditor;
        this.disableRecordingRules = (_d = instanceSettings.jsonData.disableRecordingRules) !== null && _d !== void 0 ? _d : false;
        this.variables = new PrometheusVariableSupport(this, this.templateSrv, this.timeSrv);
        this.exemplarsAvailable = true;
        this.cacheLevel = (_e = instanceSettings.jsonData.cacheLevel) !== null && _e !== void 0 ? _e : PrometheusCacheLevel.Low;
        this.cache = new QueryCache({
            getTargetSignature: this.getPrometheusTargetSignature.bind(this),
            overlapString: (_f = instanceSettings.jsonData.incrementalQueryOverlapWindow) !== null && _f !== void 0 ? _f : defaultPrometheusQueryOverlapWindow,
            profileFunction: this.getPrometheusProfileData.bind(this),
        });
        // This needs to be here and cannot be static because of how annotations typing affects casting of data source
        // objects to DataSourceApi types.
        // We don't use the default processing for prometheus.
        // See standardAnnotationSupport.ts/[shouldUseMappingUI|shouldUseLegacyRunner]
        this.annotations = {
            QueryEditor: AnnotationQueryEditor,
        };
    }
    getQueryDisplayText(query) {
        return query.expr;
    }
    getPrometheusProfileData(request, targ) {
        var _a;
        return {
            interval: (_a = targ.interval) !== null && _a !== void 0 ? _a : request.interval,
            expr: this.interpolateString(targ.expr),
            datasource: 'Prometheus',
        };
    }
    /**
     * Get target signature for query caching
     * @param request
     * @param query
     */
    getPrometheusTargetSignature(request, query) {
        var _a, _b;
        const targExpr = this.interpolateString(query.expr);
        return `${targExpr}|${(_a = query.interval) !== null && _a !== void 0 ? _a : request.interval}|${JSON.stringify((_b = request.rangeRaw) !== null && _b !== void 0 ? _b : '')}|${query.exemplar}`;
    }
    hasLabelsMatchAPISupport() {
        return (
        // https://github.com/prometheus/prometheus/releases/tag/v2.24.0
        this._isDatasourceVersionGreaterOrEqualTo('2.24.0', PromApplication.Prometheus) ||
            // All versions of Mimir support matchers for labels API
            this._isDatasourceVersionGreaterOrEqualTo('2.0.0', PromApplication.Mimir) ||
            // https://github.com/cortexproject/cortex/discussions/4542
            this._isDatasourceVersionGreaterOrEqualTo('1.11.0', PromApplication.Cortex) ||
            // https://github.com/thanos-io/thanos/pull/3566
            //https://github.com/thanos-io/thanos/releases/tag/v0.18.0
            this._isDatasourceVersionGreaterOrEqualTo('0.18.0', PromApplication.Thanos));
    }
    _isDatasourceVersionGreaterOrEqualTo(targetVersion, targetFlavor) {
        // User hasn't configured flavor/version yet, default behavior is to not support features that require version configuration when not provided
        if (!this.datasourceConfigurationPrometheusVersion || !this.datasourceConfigurationPrometheusFlavor) {
            return false;
        }
        if (targetFlavor !== this.datasourceConfigurationPrometheusFlavor) {
            return false;
        }
        return semver.gte(this.datasourceConfigurationPrometheusVersion, targetVersion);
    }
    _addTracingHeaders(httpOptions, options) {
        httpOptions.headers = {};
        if (this.access === 'proxy') {
            httpOptions.headers['X-Dashboard-UID'] = options.dashboardUID;
            httpOptions.headers['X-Panel-Id'] = options.panelId;
        }
    }
    /**
     * Any request done from this data source should go through here as it contains some common processing for the
     * request. Any processing done here needs to be also copied on the backend as this goes through data source proxy
     * but not through the same code as alerting.
     */
    _request(url, data, overrides = {}) {
        if (this.access === 'direct') {
            const error = new Error('Browser access mode in the Prometheus datasource is no longer available. Switch to server access mode.');
            return throwError(() => error);
        }
        data = data || {};
        for (const [key, value] of this.customQueryParameters) {
            if (data[key] == null) {
                data[key] = value;
            }
        }
        let queryUrl = this.url + url;
        if (url.startsWith(`/api/datasources/uid/${this.uid}`)) {
            // This url is meant to be a replacement for the whole URL. Replace the entire URL
            queryUrl = url;
        }
        const options = defaults(overrides, {
            url: queryUrl,
            method: this.httpMethod,
            headers: {},
        });
        if (options.method === 'GET') {
            if (data && Object.keys(data).length) {
                options.url =
                    options.url +
                        (options.url.search(/\?/) >= 0 ? '&' : '?') +
                        Object.entries(data)
                            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
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
    }
    importFromAbstractQueries(abstractQueries) {
        return __awaiter(this, void 0, void 0, function* () {
            return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
        });
    }
    exportToAbstractQueries(queries) {
        return __awaiter(this, void 0, void 0, function* () {
            return queries.map((query) => this.languageProvider.exportToAbstractQuery(query));
        });
    }
    // Use this for tab completion features, wont publish response to other components
    metadataRequest(url, params = {}, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // If URL includes endpoint that supports POST and GET method, try to use configured method. This might fail as POST is supported only in v2.10+.
            if (GET_AND_POST_METADATA_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
                try {
                    return yield lastValueFrom(this._request(`/api/datasources/uid/${this.uid}/resources${url}`, params, Object.assign({ method: this.httpMethod, hideFromInspector: true, showErrorAlert: false }, options)));
                }
                catch (err) {
                    // If status code of error is Method Not Allowed (405) and HTTP method is POST, retry with GET
                    if (this.httpMethod === 'POST' && isFetchError(err) && (err.status === 405 || err.status === 400)) {
                        console.warn(`Couldn't use configured POST HTTP method for this request. Trying to use GET method instead.`);
                    }
                    else {
                        throw err;
                    }
                }
            }
            return yield lastValueFrom(this._request(`/api/datasources/uid/${this.uid}/resources${url}`, params, Object.assign({ method: 'GET', hideFromInspector: true }, options))); // toPromise until we change getTagValues, getLabelNames to Observable
        });
    }
    interpolateQueryExpr(value = [], variable) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return prometheusRegularEscape(value);
        }
        if (typeof value === 'string') {
            return prometheusSpecialRegexEscape(value);
        }
        const escapedValues = value.map((val) => prometheusSpecialRegexEscape(val));
        if (escapedValues.length === 1) {
            return escapedValues[0];
        }
        return '(' + escapedValues.join('|') + ')';
    }
    targetContainsTemplate(target) {
        return this.templateSrv.containsTemplate(target.expr);
    }
    shouldRunExemplarQuery(target, request) {
        if (target.exemplar) {
            // We check all already processed targets and only create exemplar target for not used metric names
            const metricName = this.languageProvider.histogramMetrics.find((m) => target.expr.includes(m));
            // Remove targets that weren't processed yet (in targets array they are after current target)
            const currentTargetIdx = request.targets.findIndex((t) => t.refId === target.refId);
            const targets = request.targets.slice(0, currentTargetIdx).filter((t) => !t.hide);
            if (!metricName || (metricName && !targets.some((t) => t.expr.includes(metricName)))) {
                return true;
            }
            return false;
        }
        return false;
    }
    processTargetV2(target, request) {
        const processedTargets = [];
        const processedTarget = Object.assign(Object.assign({}, target), { exemplar: this.shouldRunExemplarQuery(target, request), requestId: request.panelId + target.refId, 
            // We need to pass utcOffsetSec to backend to calculate aligned range
            utcOffsetSec: this.timeSrv.timeRange().to.utcOffset() * 60 });
        if (target.instant && target.range) {
            // We have query type "Both" selected
            // We should send separate queries with different refId
            processedTargets.push(Object.assign(Object.assign({}, processedTarget), { refId: processedTarget.refId, instant: false }), Object.assign(Object.assign({}, processedTarget), { refId: processedTarget.refId + InstantQueryRefIdIndex, range: false }));
        }
        else {
            processedTargets.push(processedTarget);
        }
        return processedTargets;
    }
    query(request) {
        if (this.access === 'proxy') {
            let fullOrPartialRequest;
            let requestInfo = undefined;
            const hasInstantQuery = request.targets.some((target) => target.instant);
            // Don't cache instant queries
            if (this.hasIncrementalQuery && !hasInstantQuery) {
                requestInfo = this.cache.requestInfo(request);
                fullOrPartialRequest = requestInfo.requests[0];
            }
            else {
                fullOrPartialRequest = request;
            }
            const targets = fullOrPartialRequest.targets.map((target) => this.processTargetV2(target, fullOrPartialRequest));
            const startTime = new Date();
            return super.query(Object.assign(Object.assign({}, fullOrPartialRequest), { targets: targets.flat() })).pipe(map((response) => {
                const amendedResponse = Object.assign(Object.assign({}, response), { data: this.cache.procFrames(request, requestInfo, response.data) });
                return transformV2(amendedResponse, request, {
                    exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
                });
            }), tap((response) => {
                trackQuery(response, request, startTime);
            }));
            // Run queries through browser/proxy
        }
        else {
            const start = getPrometheusTime(request.range.from, false);
            const end = getPrometheusTime(request.range.to, true);
            const { queries, activeTargets } = this.prepareTargets(request, start, end);
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
    }
    exploreQuery(queries, activeTargets, end) {
        let runningQueriesCount = queries.length;
        const subQueries = queries.map((query, index) => {
            const target = activeTargets[index];
            const filterAndMapResponse = pipe(
            // Decrease the counter here. We assume that each request returns only single value and then completes
            // (should hold until there is some streaming requests involved).
            tap(() => runningQueriesCount--), filter((response) => (response.cancelled ? false : true)), map((response) => {
                const data = transform(response, {
                    query,
                    target,
                    responseListLength: queries.length,
                    exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
                });
                return {
                    data,
                    key: query.requestId,
                    state: runningQueriesCount === 0 ? LoadingState.Done : LoadingState.Loading,
                };
            }));
            return this.runQuery(query, end, filterAndMapResponse);
        });
        return merge(...subQueries);
    }
    panelsQuery(queries, activeTargets, end, requestId, scopedVars) {
        const observables = queries.map((query, index) => {
            const target = activeTargets[index];
            const filterAndMapResponse = pipe(filter((response) => (response.cancelled ? false : true)), map((response) => {
                const data = transform(response, {
                    query,
                    target,
                    responseListLength: queries.length,
                    scopedVars,
                    exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
                });
                return data;
            }));
            return this.runQuery(query, end, filterAndMapResponse);
        });
        return forkJoin(observables).pipe(map((results) => {
            const data = results.reduce((result, current) => {
                return [...result, ...current];
            }, []);
            return {
                data,
                key: requestId,
                state: LoadingState.Done,
            };
        }));
    }
    runQuery(query, end, filter) {
        if (query.instant) {
            return this.performInstantQuery(query, end).pipe(filter);
        }
        if (query.exemplar) {
            return this.getExemplars(query).pipe(catchError(() => {
                return of({
                    data: [],
                    state: LoadingState.Done,
                });
            }), filter);
        }
        return this.performTimeSeriesQuery(query, query.start, query.end).pipe(filter);
    }
    createQuery(target, options, start, end) {
        const query = {
            hinting: target.hinting,
            instant: target.instant,
            exemplar: target.exemplar,
            step: 0,
            expr: '',
            refId: target.refId,
            start: 0,
            end: 0,
        };
        const range = Math.ceil(end - start);
        // options.interval is the dynamically calculated interval
        let interval = rangeUtil.intervalToSeconds(options.interval);
        // Minimum interval ("Min step"), if specified for the query, or same as interval otherwise.
        const minInterval = rangeUtil.intervalToSeconds(this.templateSrv.replace(target.interval || options.interval, options.scopedVars));
        // Scrape interval as specified for the query ("Min step") or otherwise taken from the datasource.
        // Min step field can have template variables in it, make sure to replace it.
        const scrapeInterval = target.interval
            ? rangeUtil.intervalToSeconds(this.templateSrv.replace(target.interval, options.scopedVars))
            : rangeUtil.intervalToSeconds(this.interval);
        const intervalFactor = target.intervalFactor || 1;
        // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
        const adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
        let scopedVars = Object.assign(Object.assign(Object.assign({}, options.scopedVars), this.getRangeScopedVars(options.range)), this.getRateIntervalScopedVariable(adjustedInterval, scrapeInterval));
        // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
        if (interval !== adjustedInterval) {
            interval = adjustedInterval;
            scopedVars = Object.assign({}, options.scopedVars, Object.assign(Object.assign({ __interval: { text: interval + 's', value: interval + 's' }, __interval_ms: { text: interval * 1000, value: interval * 1000 } }, this.getRateIntervalScopedVariable(interval, scrapeInterval)), this.getRangeScopedVars(options.range)));
        }
        query.step = interval;
        let expr = target.expr;
        // Apply adhoc filters
        expr = this.enhanceExprWithAdHocFilters(options.filters, expr);
        // Only replace vars in expression after having (possibly) updated interval vars
        query.expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);
        // Align query interval with step to allow query caching and to ensure
        // that about-same-time query results look the same.
        const adjusted = alignRange(start, end, query.step, this.timeSrv.timeRange().to.utcOffset() * 60);
        query.start = adjusted.start;
        query.end = adjusted.end;
        this._addTracingHeaders(query, options);
        return query;
    }
    getRateIntervalScopedVariable(interval, scrapeInterval) {
        // Fall back to the default scrape interval of 15s if scrapeInterval is 0 for some reason.
        if (scrapeInterval === 0) {
            scrapeInterval = 15;
        }
        const rateInterval = Math.max(interval + scrapeInterval, 4 * scrapeInterval);
        return { __rate_interval: { text: rateInterval + 's', value: rateInterval + 's' } };
    }
    adjustInterval(interval, minInterval, range, intervalFactor) {
        // Prometheus will drop queries that might return more than 11000 data points.
        // Calculate a safe interval as an additional minimum to take into account.
        // Fractional safeIntervals are allowed, however serve little purpose if the interval is greater than 1
        // If this is the case take the ceil of the value.
        let safeInterval = range / 11000;
        if (safeInterval > 1) {
            safeInterval = Math.ceil(safeInterval);
        }
        return Math.max(interval * intervalFactor, minInterval, safeInterval);
    }
    performTimeSeriesQuery(query, start, end) {
        if (start > end) {
            throw { message: 'Invalid time range' };
        }
        const url = '/api/v1/query_range';
        const data = {
            query: query.expr,
            start,
            end,
            step: query.step,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(url, data, {
            requestId: query.requestId,
            headers: query.headers,
        }).pipe(catchError((err) => {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(this.handleErrors(err, query));
        }));
    }
    performInstantQuery(query, time) {
        const url = '/api/v1/query';
        const data = {
            query: query.expr,
            time,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(`/api/datasources/uid/${this.uid}/resources${url}`, data, {
            requestId: query.requestId,
            headers: query.headers,
        }).pipe(catchError((err) => {
            if (err.cancelled) {
                return of(err);
            }
            return throwError(this.handleErrors(err, query));
        }));
    }
    metricFindQuery(query) {
        if (!query) {
            return Promise.resolve([]);
        }
        const scopedVars = Object.assign({ __interval: { text: this.interval, value: this.interval }, __interval_ms: { text: rangeUtil.intervalToMs(this.interval), value: rangeUtil.intervalToMs(this.interval) } }, this.getRangeScopedVars(this.timeSrv.timeRange()));
        const interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
        const metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
        return metricFindQuery.process();
    }
    getRangeScopedVars(range = this.timeSrv.timeRange()) {
        const msRange = range.to.diff(range.from);
        const sRange = Math.round(msRange / 1000);
        return {
            __range_ms: { text: msRange, value: msRange },
            __range_s: { text: sRange, value: sRange },
            __range: { text: sRange + 's', value: sRange + 's' },
        };
    }
    annotationQuery(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.access === 'direct') {
                const error = new Error('Browser access mode in the Prometheus datasource is no longer available. Switch to server access mode.');
                return Promise.reject(error);
            }
            const annotation = options.annotation;
            const { expr = '' } = annotation;
            if (!expr) {
                return Promise.resolve([]);
            }
            const step = options.annotation.step || ANNOTATION_QUERY_STEP_DEFAULT;
            const queryModel = {
                expr,
                range: true,
                instant: false,
                exemplar: false,
                interval: step,
                refId: 'X',
                datasource: this.getRef(),
            };
            return yield lastValueFrom(getBackendSrv()
                .fetch({
                url: '/api/ds/query',
                method: 'POST',
                headers: this.getRequestHeaders(),
                data: {
                    from: (getPrometheusTime(options.range.from, false) * 1000).toString(),
                    to: (getPrometheusTime(options.range.to, true) * 1000).toString(),
                    queries: [this.applyTemplateVariables(queryModel, {})],
                },
                requestId: `prom-query-${annotation.name}`,
            })
                .pipe(map((rsp) => {
                return this.processAnnotationResponse(options, rsp.data);
            })));
        });
    }
    getExemplars(query) {
        const url = '/api/v1/query_exemplars';
        return this._request(url, { query: query.expr, start: query.start.toString(), end: query.end.toString() }, { requestId: query.requestId, headers: query.headers });
    }
    // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
    // this is used to get label keys, a.k.a label names
    // it is used in metric_find_query.ts
    // and in Tempo here grafana/public/app/plugins/datasource/tempo/QueryEditor/ServiceGraphSection.tsx
    getTagKeys(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options || options.filters.length === 0) {
                yield this.languageProvider.fetchLabels();
                return this.languageProvider.getLabelKeys().map((k) => ({ value: k, text: k }));
            }
            const labelFilters = options.filters.map((f) => ({
                label: f.key,
                value: f.value,
                op: f.operator,
            }));
            const expr = promQueryModeller.renderLabels(labelFilters);
            let labelsIndex;
            if (this.hasLabelsMatchAPISupport()) {
                labelsIndex = yield this.languageProvider.fetchSeriesLabelsMatch(expr);
            }
            else {
                labelsIndex = yield this.languageProvider.fetchSeriesLabels(expr);
            }
            // filter out already used labels
            return Object.keys(labelsIndex)
                .filter((labelName) => !options.filters.find((filter) => filter.key === labelName))
                .map((k) => ({ value: k, text: k }));
        });
    }
    // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
    getTagValues(options) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const labelFilters = options.filters.map((f) => ({
                label: f.key,
                value: f.value,
                op: f.operator,
            }));
            const expr = promQueryModeller.renderLabels(labelFilters);
            if (this.hasLabelsMatchAPISupport()) {
                return (yield this.languageProvider.fetchSeriesValuesWithMatch(options.key, expr)).map((v) => ({
                    value: v,
                    text: v,
                }));
            }
            const params = this.getTimeRangeParams();
            const result = yield this.metadataRequest(`/api/v1/label/${options.key}/values`, params);
            return (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.map((value) => ({ text: value }))) !== null && _c !== void 0 ? _c : [];
        });
    }
    interpolateVariablesInQueries(queries, scopedVars, filters) {
        let expandedQueries = queries;
        if (queries && queries.length) {
            expandedQueries = queries.map((query) => {
                const interpolatedQuery = this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr);
                const withAdhocFilters = this.enhanceExprWithAdHocFilters(filters, interpolatedQuery);
                const expandedQuery = Object.assign(Object.assign({}, query), { datasource: this.getRef(), expr: withAdhocFilters, interval: this.templateSrv.replace(query.interval, scopedVars) });
                return expandedQuery;
            });
        }
        return expandedQueries;
    }
    getQueryHints(query, result) {
        var _a;
        return getQueryHints((_a = query.expr) !== null && _a !== void 0 ? _a : '', result, this);
    }
    getInitHints() {
        return getInitHints(this);
    }
    loadRules() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield this.metadataRequest('/api/v1/rules', {}, { showErrorAlert: false });
                const groups = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.groups;
                if (groups) {
                    this.ruleMappings = extractRuleMappingFromGroups(groups);
                }
            }
            catch (e) {
                console.log('Rules API is experimental. Ignore next error.');
                console.error(e);
            }
        });
    }
    areExemplarsAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield this.metadataRequest('/api/v1/query_exemplars', {
                    query: 'test',
                    start: dateTime().subtract(30, 'minutes').valueOf().toString(),
                    end: dateTime().valueOf().toString(),
                }, {
                    // Avoid alerting the user if this test fails
                    showErrorAlert: false,
                });
                if (res.data.status === 'success') {
                    return true;
                }
                return false;
            }
            catch (err) {
                return false;
            }
        });
    }
    modifyQuery(query, action) {
        var _a, _b, _c;
        let expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        switch (action.type) {
            case 'ADD_FILTER': {
                const { key, value } = (_b = action.options) !== null && _b !== void 0 ? _b : {};
                if (key && value) {
                    expression = addLabelToQuery(expression, key, value);
                }
                break;
            }
            case 'ADD_FILTER_OUT': {
                const { key, value } = (_c = action.options) !== null && _c !== void 0 ? _c : {};
                if (key && value) {
                    expression = addLabelToQuery(expression, key, value, '!=');
                }
                break;
            }
            case 'ADD_HISTOGRAM_QUANTILE': {
                expression = `histogram_quantile(0.95, sum(rate(${expression}[$__rate_interval])) by (le))`;
                break;
            }
            case 'ADD_RATE': {
                expression = `rate(${expression}[$__rate_interval])`;
                break;
            }
            case 'ADD_SUM': {
                expression = `sum(${expression.trim()}) by ($1)`;
                break;
            }
            case 'EXPAND_RULES': {
                if (action.options) {
                    expression = expandRecordingRules(expression, action.options);
                }
                break;
            }
            default:
                break;
        }
        return Object.assign(Object.assign({}, query), { expr: expression });
    }
    /**
     * Returns the adjusted "snapped" interval parameters
     */
    getAdjustedInterval() {
        const range = this.timeSrv.timeRange();
        return getRangeSnapInterval(this.cacheLevel, range);
    }
    /**
     * This will return a time range that always includes the users current time range,
     * and then a little extra padding to round up/down to the nearest nth minute,
     * defined by the result of the getCacheDurationInMinutes.
     *
     * For longer cache durations, and shorter query durations, the window we're calculating might be much bigger then the user's current window,
     * resulting in us returning labels/values that might not be applicable for the given window, this is a necessary trade off if we want to cache larger durations
     *
     */
    getTimeRangeParams() {
        const range = this.timeSrv.timeRange();
        return {
            start: getPrometheusTime(range.from, false).toString(),
            end: getPrometheusTime(range.to, true).toString(),
        };
    }
    getOriginalMetricName(labelData) {
        return getOriginalMetricName(labelData);
    }
    enhanceExprWithAdHocFilters(filters, expr) {
        if (!filters || filters.length === 0) {
            return expr;
        }
        const finalQuery = filters.reduce((acc, filter) => {
            const { key, operator } = filter;
            let { value } = filter;
            if (operator === '=~' || operator === '!~') {
                value = prometheusRegularEscape(value);
            }
            return addLabelToQuery(acc, key, value, operator);
        }, expr);
        return finalQuery;
    }
    // Used when running queries through backend
    filterQuery(query) {
        if (query.hide || !query.expr) {
            return false;
        }
        return true;
    }
    // Used when running queries through backend
    applyTemplateVariables(target, scopedVars, filters) {
        const variables = cloneDeep(scopedVars);
        // We want to interpolate these variables on backend
        delete variables.__interval;
        delete variables.__interval_ms;
        // interpolate expression
        const expr = this.templateSrv.replace(target.expr, variables, this.interpolateQueryExpr);
        // Add ad hoc filters
        const exprWithAdHocFilters = this.enhanceExprWithAdHocFilters(filters, expr);
        return Object.assign(Object.assign({}, target), { expr: exprWithAdHocFilters, interval: this.templateSrv.replace(target.interval, variables), legendFormat: this.templateSrv.replace(target.legendFormat, variables) });
    }
    getVariables() {
        return this.templateSrv.getVariables().map((v) => `$${v.name}`);
    }
    interpolateString(string) {
        return this.templateSrv.replace(string, undefined, this.interpolateQueryExpr);
    }
    getDebounceTimeInMilliseconds() {
        switch (this.cacheLevel) {
            case PrometheusCacheLevel.Medium:
                return 600;
            case PrometheusCacheLevel.High:
                return 1200;
            default:
                return 350;
        }
    }
    getDaysToCacheMetadata() {
        switch (this.cacheLevel) {
            case PrometheusCacheLevel.Medium:
                return 7;
            case PrometheusCacheLevel.High:
                return 30;
            default:
                return 1;
        }
    }
    getCacheDurationInMinutes() {
        return getClientCacheDurationInMinutes(this.cacheLevel);
    }
    getDefaultQuery(app) {
        const defaults = {
            refId: 'A',
            expr: '',
            range: true,
            instant: false,
        };
        if (app === CoreApp.UnifiedAlerting) {
            return Object.assign(Object.assign({}, defaults), { instant: true, range: false });
        }
        if (app === CoreApp.Explore) {
            return Object.assign(Object.assign({}, defaults), { instant: true, range: true });
        }
        return defaults;
    }
}
/**
 * Align query range to step.
 * Rounds start and end down to a multiple of step.
 * @param start Timestamp marking the beginning of the range.
 * @param end Timestamp marking the end of the range.
 * @param step Interval to align start and end with.
 * @param utcOffsetSec Number of seconds current timezone is offset from UTC
 */
export function alignRange(start, end, step, utcOffsetSec) {
    const alignedEnd = Math.floor((end + utcOffsetSec) / step) * step - utcOffsetSec;
    const alignedStart = Math.floor((start + utcOffsetSec) / step) * step - utcOffsetSec;
    return {
        end: alignedEnd,
        start: alignedStart,
    };
}
export function extractRuleMappingFromGroups(groups) {
    return groups.reduce((mapping, group) => group.rules
        .filter((rule) => rule.type === 'recording')
        .reduce((acc, rule) => (Object.assign(Object.assign({}, acc), { [rule.name]: rule.query })), mapping), {});
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