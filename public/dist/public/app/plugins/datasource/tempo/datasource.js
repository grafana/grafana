import { __awaiter } from "tslib";
import { groupBy, identity, pick, pickBy, startCase } from 'lodash';
import { EMPTY, from, lastValueFrom, merge, of, throwError } from 'rxjs';
import { catchError, concatMap, map, mergeMap, toArray } from 'rxjs/operators';
import semver from 'semver';
import { CoreApp, dateTime, FieldType, isValidGoDuration, LoadingState, rangeUtil, } from '@grafana/data';
import { config, DataSourceWithBackend, getBackendSrv, getTemplateSrv, reportInteraction, } from '@grafana/runtime';
import { BarGaugeDisplayMode, TableCellDisplayMode, VariableFormatID } from '@grafana/schema';
import { serializeParams } from 'app/core/utils/fetch';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { generateQueryFromFilters } from './SearchTraceQLEditor/utils';
import { TempoVariableQueryType } from './VariableQueryEditor';
import { TraceqlSearchScope } from './dataquery.gen';
import { defaultTableFilter, durationMetric, errorRateMetric, failedMetric, histogramMetric, mapPromMetricsToServiceMap, rateMetric, serviceMapMetrics, totalsMetric, } from './graphTransform';
import TempoLanguageProvider from './language_provider';
import { createTableFrameFromMetricsSummaryQuery, emptyResponse } from './metricsSummary';
import { createTableFrameFromSearch, transformFromOTLP as transformFromOTEL, transformTrace, transformTraceList, formatTraceQLResponse, } from './resultTransformer';
import { doTempoChannelStream } from './streaming';
import { getErrorMessage } from './utils';
import { TempoVariableSupport } from './variables';
export const DEFAULT_LIMIT = 20;
export const DEFAULT_SPSS = 3; // spans per span set
var FeatureName;
(function (FeatureName) {
    FeatureName["streaming"] = "streaming";
})(FeatureName || (FeatureName = {}));
/* Map, for each feature (e.g., streaming), the minimum Tempo version required to have that
 ** feature available. If the running Tempo instance on the user's backend is older than the
 ** target version, the feature is disabled in Grafana (frontend).
 */
const featuresToTempoVersion = {
    [FeatureName.streaming]: '2.2.0',
};
// The version that we use as default in case we cannot retrieve it from the backend.
// This is the last minor version of Tempo that does not expose the endpoint for build information.
const defaultTempoVersion = '2.1.0';
export class TempoDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        var _a;
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.uploadedJson = null;
        this.init = () => __awaiter(this, void 0, void 0, function* () {
            const response = yield lastValueFrom(this._request('/api/status/buildinfo').pipe(map((response) => response), catchError((error) => {
                console.error('Failure in retrieving build information', error.data.message);
                return of({ error, data: { version: null } }); // unknown version
            })));
            this.tempoVersion = response.data.version;
        });
        this.handleMetricsSummary = (target, query, options) => {
            var _a, _b, _c;
            reportInteraction('grafana_traces_metrics_summary_queried', {
                datasourceType: 'tempo',
                app: (_a = options.app) !== null && _a !== void 0 ? _a : '',
                grafana_version: config.buildInfo.version,
                filterCount: (_c = (_b = target.groupBy) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0,
            });
            if (query === '{}') {
                return of({
                    error: {
                        message: 'Please ensure you do not have an empty query. This is so filters are applied and the metrics summary is not generated from all spans.',
                    },
                    data: emptyResponse,
                });
            }
            const groupBy = target.groupBy ? this.formatGroupBy(target.groupBy) : '';
            return this._request('/api/metrics/summary', {
                q: query,
                groupBy,
                start: options.range.from.unix(),
                end: options.range.to.unix(),
            }).pipe(map((response) => {
                if (!response.data.summaries) {
                    return {
                        error: {
                            message: getErrorMessage(`No summary data for '${groupBy}'. Note: the metrics summary API only considers spans of kind = server. You can check if the attributes exist by running a TraceQL query like { attr_key = attr_value && kind = server }`),
                        },
                        data: emptyResponse,
                    };
                }
                // Check if any of the results have series data as older versions of Tempo placed the series data in a different structure
                const hasSeries = response.data.summaries.some((summary) => summary.series.length > 0);
                if (!hasSeries) {
                    return {
                        error: {
                            message: getErrorMessage(`No series data. Ensure you are using an up to date version of Tempo`),
                        },
                        data: emptyResponse,
                    };
                }
                return {
                    data: createTableFrameFromMetricsSummaryQuery(response.data.summaries, query, this.instanceSettings),
                };
            }), catchError((error) => {
                return of({
                    error: { message: getErrorMessage(error.data.message) },
                    data: emptyResponse,
                });
            }));
        };
        this.formatGroupBy = (groupBy) => {
            return groupBy === null || groupBy === void 0 ? void 0 : groupBy.filter((f) => f.tag).map((f) => {
                if (f.scope === TraceqlSearchScope.Unscoped) {
                    return `.${f.tag}`;
                }
                return f.scope !== TraceqlSearchScope.Intrinsic ? `${f.scope}.${f.tag}` : f.tag;
            }).join(', ');
        };
        this.hasGroupBy = (query) => {
            var _a;
            return (_a = query.groupBy) === null || _a === void 0 ? void 0 : _a.find((gb) => gb.tag);
        };
        // Get linked loki search datasource. Fall back to legacy loki search/trace to logs config
        this.getLokiSearchDS = () => {
            var _a, _b, _c, _d;
            const legacyLogsDatasourceUid = ((_a = this.tracesToLogs) === null || _a === void 0 ? void 0 : _a.lokiSearch) !== false && this.lokiSearch === undefined
                ? (_b = this.tracesToLogs) === null || _b === void 0 ? void 0 : _b.datasourceUid
                : undefined;
            return (_d = (_c = this.lokiSearch) === null || _c === void 0 ? void 0 : _c.datasourceUid) !== null && _d !== void 0 ? _d : legacyLogsDatasourceUid;
        };
        this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
        this.serviceMap = instanceSettings.jsonData.serviceMap;
        this.search = instanceSettings.jsonData.search;
        this.nodeGraph = instanceSettings.jsonData.nodeGraph;
        this.lokiSearch = instanceSettings.jsonData.lokiSearch;
        this.traceQuery = instanceSettings.jsonData.traceQuery;
        this.languageProvider = new TempoLanguageProvider(this);
        if (!((_a = this.search) === null || _a === void 0 ? void 0 : _a.filters)) {
            this.search = Object.assign(Object.assign({}, this.search), { filters: [
                    {
                        id: 'service-name',
                        tag: 'service.name',
                        operator: '=',
                        scope: TraceqlSearchScope.Resource,
                    },
                    { id: 'span-name', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
                ] });
        }
        this.variables = new TempoVariableSupport(this);
    }
    executeVariableQuery(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // Avoid failing if the user did not select the query type (label names, label values, etc.)
            if (query.type === undefined) {
                return new Promise(() => []);
            }
            switch (query.type) {
                case TempoVariableQueryType.LabelNames: {
                    return yield this.labelNamesQuery();
                }
                case TempoVariableQueryType.LabelValues: {
                    return this.labelValuesQuery(query.label);
                }
                default: {
                    throw Error('Invalid query type', query.type);
                }
            }
        });
    }
    labelNamesQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.languageProvider.fetchTags();
            const tags = this.languageProvider.getAutocompleteTags();
            return tags.filter((tag) => tag !== undefined).map((tag) => ({ text: tag }));
        });
    }
    labelValuesQuery(labelName) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!labelName) {
                return [];
            }
            let options;
            try {
                // Retrieve the scope of the tag
                // Example: given `http.status_code`, we want scope `span`
                // Note that we ignore possible name clashes, e.g., `http.status_code` in both `span` and `resource`
                const scope = (_a = (this.languageProvider.tagsV2 || [])
                    // flatten the Scope objects
                    .flatMap((tagV2) => tagV2.tags.map((tag) => ({ scope: tagV2.name, name: tag })))
                    // find associated scope
                    .find((tag) => tag.name === labelName)) === null || _a === void 0 ? void 0 : _a.scope;
                if (!scope) {
                    throw Error(`Scope for tag ${labelName} not found`);
                }
                // For V2, we need to send scope and tag name, e.g. `span.http.status_code`,
                // unless the tag has intrinsic scope
                const scopeAndTag = scope === 'intrinsic' ? labelName : `${scope}.${labelName}`;
                options = yield this.languageProvider.getOptionsV2(scopeAndTag);
            }
            catch (_b) {
                // For V1, the tag name (e.g. `http.status_code`) is enough
                options = yield this.languageProvider.getOptionsV1(labelName);
            }
            return options.filter((option) => option.value !== undefined).map((option) => ({ text: option.value }));
        });
    }
    /**
     * Check, for the given feature, whether it is available in Grafana.
     *
     * The check is done based on the version of the Tempo instance running on the backend and
     * the minimum version required by the given feature to work.
     *
     * @param featureName - the name of the feature to consider
     * @return true if the feature is available, false otherwise
     */
    isFeatureAvailable(featureName) {
        var _a;
        // We know for old Tempo instances we don't know their version, so resort to default
        const actualVersion = (_a = this.tempoVersion) !== null && _a !== void 0 ? _a : defaultTempoVersion;
        try {
            return semver.gte(actualVersion, featuresToTempoVersion[featureName]);
        }
        catch (_b) {
            // We assume we are on a development and recent branch, thus we enable all features
            return true;
        }
    }
    query(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        const subQueries = [];
        const filteredTargets = options.targets.filter((target) => !target.hide);
        const targets = groupBy(filteredTargets, (t) => t.queryType || 'traceql');
        if (targets.clear) {
            return of({ data: [], state: LoadingState.Done });
        }
        const logsDatasourceUid = this.getLokiSearchDS();
        // Run search queries on linked datasource
        if (logsDatasourceUid && ((_a = targets.search) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            reportInteraction('grafana_traces_loki_search_queried', {
                datasourceType: 'tempo',
                app: (_b = options.app) !== null && _b !== void 0 ? _b : '',
                grafana_version: config.buildInfo.version,
                hasLinkedQueryExpr: ((_c = targets.search[0].linkedQuery) === null || _c === void 0 ? void 0 : _c.expr) && ((_d = targets.search[0].linkedQuery) === null || _d === void 0 ? void 0 : _d.expr) !== '' ? true : false,
            });
            const dsSrv = getDatasourceSrv();
            subQueries.push(from(dsSrv.get(logsDatasourceUid)).pipe(mergeMap((linkedDatasource) => {
                var _a;
                // Wrap linked query into a data request based on original request
                const linkedRequest = Object.assign(Object.assign({}, options), { targets: targets.search.map((t) => t.linkedQuery) });
                // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
                const settings = linkedDatasource.instanceSettings;
                const traceLinkMatcher = ((_a = settings.jsonData.derivedFields) === null || _a === void 0 ? void 0 : _a.filter((field) => field.datasourceUid === this.uid && field.matcherRegex).map((field) => field.matcherRegex)) || [];
                if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
                    return throwError(() => new Error('No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.'));
                }
                else {
                    return linkedDatasource.query(linkedRequest).pipe(map((response) => response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkMatcher)));
                }
            })));
        }
        if ((_e = targets.nativeSearch) === null || _e === void 0 ? void 0 : _e.length) {
            try {
                reportInteraction('grafana_traces_search_queried', {
                    datasourceType: 'tempo',
                    app: (_f = options.app) !== null && _f !== void 0 ? _f : '',
                    grafana_version: config.buildInfo.version,
                    hasServiceName: targets.nativeSearch[0].serviceName ? true : false,
                    hasSpanName: targets.nativeSearch[0].spanName ? true : false,
                    resultLimit: (_g = targets.nativeSearch[0].limit) !== null && _g !== void 0 ? _g : '',
                    hasSearch: targets.nativeSearch[0].search ? true : false,
                    minDuration: (_h = targets.nativeSearch[0].minDuration) !== null && _h !== void 0 ? _h : '',
                    maxDuration: (_j = targets.nativeSearch[0].maxDuration) !== null && _j !== void 0 ? _j : '',
                });
                const timeRange = { startTime: options.range.from.unix(), endTime: options.range.to.unix() };
                const query = this.applyVariables(targets.nativeSearch[0], options.scopedVars);
                const searchQuery = this.buildSearchQuery(query, timeRange);
                subQueries.push(this._request('/api/search', searchQuery).pipe(map((response) => {
                    return {
                        data: [createTableFrameFromSearch(response.data.traces, this.instanceSettings)],
                    };
                }), catchError((err) => {
                    return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
                })));
            }
            catch (error) {
                return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
            }
        }
        if ((_k = targets.traceql) === null || _k === void 0 ? void 0 : _k.length) {
            try {
                const appliedQuery = this.applyVariables(targets.traceql[0], options.scopedVars);
                const queryValue = (appliedQuery === null || appliedQuery === void 0 ? void 0 : appliedQuery.query) || '';
                const hexOnlyRegex = /^[0-9A-Fa-f]*$/;
                // Check whether this is a trace ID or traceQL query by checking if it only contains hex characters
                if (queryValue.trim().match(hexOnlyRegex)) {
                    // There's only hex characters so let's assume that this is a trace ID
                    reportInteraction('grafana_traces_traceID_queried', {
                        datasourceType: 'tempo',
                        app: (_l = options.app) !== null && _l !== void 0 ? _l : '',
                        grafana_version: config.buildInfo.version,
                        hasQuery: queryValue !== '' ? true : false,
                    });
                    subQueries.push(this.handleTraceIdQuery(options, targets.traceql));
                }
                else {
                    reportInteraction('grafana_traces_traceql_queried', {
                        datasourceType: 'tempo',
                        app: (_m = options.app) !== null && _m !== void 0 ? _m : '',
                        grafana_version: config.buildInfo.version,
                        query: queryValue !== null && queryValue !== void 0 ? queryValue : '',
                        streaming: config.featureToggles.traceQLStreaming,
                    });
                    if (config.featureToggles.traceQLStreaming && this.isFeatureAvailable(FeatureName.streaming)) {
                        subQueries.push(this.handleStreamingSearch(options, targets.traceql, queryValue));
                    }
                    else {
                        subQueries.push(this._request('/api/search', {
                            q: queryValue,
                            limit: (_o = options.targets[0].limit) !== null && _o !== void 0 ? _o : DEFAULT_LIMIT,
                            spss: (_p = options.targets[0].spss) !== null && _p !== void 0 ? _p : DEFAULT_SPSS,
                            start: options.range.from.unix(),
                            end: options.range.to.unix(),
                        }).pipe(map((response) => {
                            return {
                                data: formatTraceQLResponse(response.data.traces, this.instanceSettings, targets.traceql[0].tableType),
                            };
                        }), catchError((err) => {
                            return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
                        })));
                    }
                }
            }
            catch (error) {
                return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
            }
        }
        if ((_q = targets.traceqlSearch) === null || _q === void 0 ? void 0 : _q.length) {
            try {
                if (config.featureToggles.metricsSummary) {
                    const groupBy = targets.traceqlSearch.find((t) => this.hasGroupBy(t));
                    if (groupBy) {
                        subQueries.push(this.handleMetricsSummary(groupBy, generateQueryFromFilters(groupBy.filters), options));
                    }
                }
                const traceqlSearchTargets = config.featureToggles.metricsSummary
                    ? targets.traceqlSearch.filter((t) => !this.hasGroupBy(t))
                    : targets.traceqlSearch;
                if (traceqlSearchTargets.length > 0) {
                    const queryValueFromFilters = generateQueryFromFilters(traceqlSearchTargets[0].filters);
                    // We want to support template variables also in Search for consistency with other data sources
                    const queryValue = this.templateSrv.replace(queryValueFromFilters, options.scopedVars);
                    reportInteraction('grafana_traces_traceql_search_queried', {
                        datasourceType: 'tempo',
                        app: (_r = options.app) !== null && _r !== void 0 ? _r : '',
                        grafana_version: config.buildInfo.version,
                        query: queryValue !== null && queryValue !== void 0 ? queryValue : '',
                        streaming: config.featureToggles.traceQLStreaming,
                    });
                    if (config.featureToggles.traceQLStreaming && this.isFeatureAvailable(FeatureName.streaming)) {
                        subQueries.push(this.handleStreamingSearch(options, traceqlSearchTargets, queryValue));
                    }
                    else {
                        subQueries.push(this._request('/api/search', {
                            q: queryValue,
                            limit: (_s = options.targets[0].limit) !== null && _s !== void 0 ? _s : DEFAULT_LIMIT,
                            spss: (_t = options.targets[0].spss) !== null && _t !== void 0 ? _t : DEFAULT_SPSS,
                            start: options.range.from.unix(),
                            end: options.range.to.unix(),
                        }).pipe(map((response) => {
                            return {
                                data: formatTraceQLResponse(response.data.traces, this.instanceSettings, targets.traceqlSearch[0].tableType),
                            };
                        }), catchError((err) => {
                            return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
                        })));
                    }
                }
            }
            catch (error) {
                return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
            }
        }
        if ((_u = targets.upload) === null || _u === void 0 ? void 0 : _u.length) {
            if (this.uploadedJson) {
                reportInteraction('grafana_traces_json_file_uploaded', {
                    datasourceType: 'tempo',
                    app: (_v = options.app) !== null && _v !== void 0 ? _v : '',
                    grafana_version: config.buildInfo.version,
                });
                const jsonData = JSON.parse(this.uploadedJson);
                const isTraceData = jsonData.batches;
                const isServiceGraphData = Array.isArray(jsonData) && jsonData.some((df) => { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'nodeGraph'; });
                if (isTraceData) {
                    subQueries.push(of(transformFromOTEL(jsonData.batches, (_w = this.nodeGraph) === null || _w === void 0 ? void 0 : _w.enabled)));
                }
                else if (isServiceGraphData) {
                    subQueries.push(of({ data: jsonData, state: LoadingState.Done }));
                }
                else {
                    subQueries.push(of({ error: { message: 'Unable to parse uploaded data.' }, data: [] }));
                }
            }
            else {
                subQueries.push(of({ data: [], state: LoadingState.Done }));
            }
        }
        if (((_x = this.serviceMap) === null || _x === void 0 ? void 0 : _x.datasourceUid) && ((_y = targets.serviceMap) === null || _y === void 0 ? void 0 : _y.length) > 0) {
            reportInteraction('grafana_traces_service_graph_queried', {
                datasourceType: 'tempo',
                app: (_z = options.app) !== null && _z !== void 0 ? _z : '',
                grafana_version: config.buildInfo.version,
                hasServiceMapQuery: targets.serviceMap[0].serviceMapQuery ? true : false,
            });
            const dsId = this.serviceMap.datasourceUid;
            const tempoDsUid = this.uid;
            subQueries.push(serviceMapQuery(options, dsId, tempoDsUid).pipe(concatMap((result) => rateQuery(options, result, dsId).pipe(concatMap((result) => errorAndDurationQuery(options, result, dsId, tempoDsUid))))));
        }
        return merge(...subQueries);
    }
    applyTemplateVariables(query, scopedVars) {
        return this.applyVariables(query, scopedVars);
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        if (!queries || queries.length === 0) {
            return [];
        }
        return queries.map((query) => {
            return Object.assign(Object.assign(Object.assign({}, query), { datasource: this.getRef() }), this.applyVariables(query, scopedVars));
        });
    }
    applyVariables(query, scopedVars) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const expandedQuery = Object.assign({}, query);
        if (query.linkedQuery) {
            expandedQuery.linkedQuery = Object.assign(Object.assign({}, query.linkedQuery), { expr: this.templateSrv.replace((_b = (_a = query.linkedQuery) === null || _a === void 0 ? void 0 : _a.expr) !== null && _b !== void 0 ? _b : '', scopedVars) });
        }
        return Object.assign(Object.assign({}, expandedQuery), { query: this.templateSrv.replace((_c = query.query) !== null && _c !== void 0 ? _c : '', scopedVars, VariableFormatID.Pipe), serviceName: this.templateSrv.replace((_d = query.serviceName) !== null && _d !== void 0 ? _d : '', scopedVars), spanName: this.templateSrv.replace((_e = query.spanName) !== null && _e !== void 0 ? _e : '', scopedVars), search: this.templateSrv.replace((_f = query.search) !== null && _f !== void 0 ? _f : '', scopedVars), minDuration: this.templateSrv.replace((_g = query.minDuration) !== null && _g !== void 0 ? _g : '', scopedVars), maxDuration: this.templateSrv.replace((_h = query.maxDuration) !== null && _h !== void 0 ? _h : '', scopedVars) });
    }
    /**
     * Handles the simplest of the queries where we have just a trace id and return trace data for it.
     * @param options
     * @param targets
     * @private
     */
    handleTraceIdQuery(options, targets) {
        const validTargets = targets
            .filter((t) => t.query)
            .map((t) => { var _a; return (Object.assign(Object.assign({}, t), { query: (_a = t.query) === null || _a === void 0 ? void 0 : _a.trim(), queryType: 'traceId' })); });
        if (!validTargets.length) {
            return EMPTY;
        }
        const traceRequest = this.traceIdQueryRequest(options, validTargets);
        return super.query(traceRequest).pipe(map((response) => {
            var _a;
            if (response.error) {
                return response;
            }
            return transformTrace(response, (_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled);
        }));
    }
    traceIdQueryRequest(options, targets) {
        var _a, _b, _c;
        const request = Object.assign(Object.assign({}, options), { targets });
        if ((_a = this.traceQuery) === null || _a === void 0 ? void 0 : _a.timeShiftEnabled) {
            request.range = options.range && Object.assign(Object.assign({}, options.range), { from: options.range.from.subtract(rangeUtil.intervalToMs(((_b = this.traceQuery) === null || _b === void 0 ? void 0 : _b.spanStartTimeShift) || '30m'), 'milliseconds'), to: options.range.to.add(rangeUtil.intervalToMs(((_c = this.traceQuery) === null || _c === void 0 ? void 0 : _c.spanEndTimeShift) || '30m'), 'milliseconds') });
        }
        else {
            request.range = { from: dateTime(0), to: dateTime(0), raw: { from: dateTime(0), to: dateTime(0) } };
        }
        return request;
    }
    // This function can probably be simplified by avoiding passing both `targets` and `query`,
    // since `query` is built from `targets`, if you look at how this function is currently called
    handleStreamingSearch(options, targets, query) {
        if (query === '') {
            return EMPTY;
        }
        return merge(...targets.map((target) => doTempoChannelStream(Object.assign(Object.assign({}, target), { query }), this, // the datasource
        options, this.instanceSettings)));
    }
    metadataRequest(url, params = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield lastValueFrom(this._request(url, params, { method: 'GET', hideFromInspector: true }));
        });
    }
    _request(apiUrl, data, options) {
        const params = data ? serializeParams(data) : '';
        const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
        const req = Object.assign(Object.assign({}, options), { url });
        return getBackendSrv().fetch(req);
    }
    testDatasource() {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                headers: {},
                method: 'GET',
                url: `${this.instanceSettings.url}/api/echo`,
            };
            return yield lastValueFrom(getBackendSrv()
                .fetch(options)
                .pipe(mergeMap(() => {
                return of({ status: 'success', message: 'Data source successfully connected.' });
            }), catchError((err) => {
                return of({ status: 'error', message: getErrorMessage(err.data.message, 'Unable to connect with Tempo') });
            })));
        });
    }
    getQueryDisplayText(query) {
        var _a;
        if (query.queryType === 'nativeSearch') {
            let result = [];
            for (const key of ['serviceName', 'spanName', 'search', 'minDuration', 'maxDuration', 'limit']) {
                if (query.hasOwnProperty(key) && query[key]) {
                    result.push(`${startCase(key)}: ${query[key]}`);
                }
            }
            return result.join(', ');
        }
        return (_a = query.query) !== null && _a !== void 0 ? _a : '';
    }
    buildSearchQuery(query, timeRange) {
        var _a, _b, _c;
        let tags = (_a = query.search) !== null && _a !== void 0 ? _a : '';
        let tempoQuery = pick(query, ['minDuration', 'maxDuration', 'limit']);
        // Remove empty properties
        tempoQuery = pickBy(tempoQuery, identity);
        if (query.serviceName) {
            tags += ` service.name="${query.serviceName}"`;
        }
        if (query.spanName) {
            tags += ` name="${query.spanName}"`;
        }
        // Set default limit
        if (!tempoQuery.limit) {
            tempoQuery.limit = DEFAULT_LIMIT;
        }
        // Validate query inputs and remove spaces if valid
        if (tempoQuery.minDuration) {
            tempoQuery.minDuration = this.templateSrv.replace((_b = tempoQuery.minDuration) !== null && _b !== void 0 ? _b : '');
            if (!isValidGoDuration(tempoQuery.minDuration)) {
                throw new Error('Please enter a valid min duration.');
            }
            tempoQuery.minDuration = tempoQuery.minDuration.replace(/\s/g, '');
        }
        if (tempoQuery.maxDuration) {
            tempoQuery.maxDuration = this.templateSrv.replace((_c = tempoQuery.maxDuration) !== null && _c !== void 0 ? _c : '');
            if (!isValidGoDuration(tempoQuery.maxDuration)) {
                throw new Error('Please enter a valid max duration.');
            }
            tempoQuery.maxDuration = tempoQuery.maxDuration.replace(/\s/g, '');
        }
        if (!Number.isInteger(tempoQuery.limit) || tempoQuery.limit <= 0) {
            throw new Error('Please enter a valid limit.');
        }
        let searchQuery = Object.assign({ tags }, tempoQuery);
        if (timeRange) {
            searchQuery.start = timeRange.startTime;
            searchQuery.end = timeRange.endTime;
        }
        return searchQuery;
    }
}
function queryPrometheus(request, datasourceUid) {
    return from(getDatasourceSrv().get(datasourceUid)).pipe(mergeMap((ds) => {
        return ds.query(request);
    }));
}
function serviceMapQuery(request, datasourceUid, tempoDatasourceUid) {
    const serviceMapRequest = makePromServiceMapRequest(request);
    return queryPrometheus(serviceMapRequest, datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(), map((responses) => {
        var _a;
        const errorRes = responses.find((res) => !!res.error);
        if (errorRes) {
            throw new Error(getErrorMessage((_a = errorRes.error) === null || _a === void 0 ? void 0 : _a.message));
        }
        const { nodes, edges } = mapPromMetricsToServiceMap(responses, request.range);
        if (nodes.fields.length > 0 && edges.fields.length > 0) {
            const nodeLength = nodes.fields[0].values.length;
            const edgeLength = edges.fields[0].values.length;
            reportInteraction('grafana_traces_service_graph_size', {
                datasourceType: 'tempo',
                grafana_version: config.buildInfo.version,
                nodeLength,
                edgeLength,
            });
        }
        // No handling of multiple targets assume just one. NodeGraph does not support it anyway, but still should be
        // fixed at some point.
        const { serviceMapIncludeNamespace, refId } = request.targets[0];
        nodes.refId = refId;
        edges.refId = refId;
        if (serviceMapIncludeNamespace) {
            nodes.fields[0].config = getFieldConfig(datasourceUid, // datasourceUid
            tempoDatasourceUid, // tempoDatasourceUid
            '__data.fields.title', // targetField
            '__data.fields[0]', // tempoField
            undefined, // sourceField
            { targetNamespace: '__data.fields.subtitle' });
            edges.fields[0].config = getFieldConfig(datasourceUid, // datasourceUid
            tempoDatasourceUid, // tempoDatasourceUid
            '__data.fields.targetName', // targetField
            '__data.fields.target', // tempoField
            '__data.fields.sourceName', // sourceField
            { targetNamespace: '__data.fields.targetNamespace', sourceNamespace: '__data.fields.sourceNamespace' });
        }
        else {
            nodes.fields[0].config = getFieldConfig(datasourceUid, tempoDatasourceUid, '__data.fields.id', '__data.fields[0]');
            edges.fields[0].config = getFieldConfig(datasourceUid, tempoDatasourceUid, '__data.fields.target', '__data.fields.target', '__data.fields.source');
        }
        return {
            nodes,
            edges,
            state: LoadingState.Done,
        };
    }));
}
function rateQuery(request, serviceMapResponse, datasourceUid) {
    const serviceMapRequest = makePromServiceMapRequest(request);
    serviceMapRequest.targets = makeServiceGraphViewRequest([buildExpr(rateMetric, defaultTableFilter, request)]);
    return queryPrometheus(serviceMapRequest, datasourceUid).pipe(toArray(), map((responses) => {
        var _a, _b, _c;
        const errorRes = responses.find((res) => !!res.error);
        if (errorRes) {
            throw new Error(getErrorMessage((_a = errorRes.error) === null || _a === void 0 ? void 0 : _a.message));
        }
        return {
            rates: (_c = (_b = responses[0]) === null || _b === void 0 ? void 0 : _b.data) !== null && _c !== void 0 ? _c : [],
            nodes: serviceMapResponse.nodes,
            edges: serviceMapResponse.edges,
        };
    }));
}
// we need the response from the rate query to get the rate span_name(s),
// -> which determine the errorRate/duration span_name(s) we need to query
function errorAndDurationQuery(request, rateResponse, datasourceUid, tempoDatasourceUid) {
    let serviceGraphViewMetrics = [];
    let errorRateBySpanName = '';
    let durationsBySpanName = [];
    let labels = [];
    if (rateResponse.rates[0] && request.app === CoreApp.Explore) {
        const spanNameField = rateResponse.rates[0].fields.find((field) => field.name === 'span_name');
        if (spanNameField && spanNameField.values) {
            labels = spanNameField.values;
        }
    }
    else if (rateResponse.rates) {
        rateResponse.rates.map((df) => {
            var _a;
            const spanNameLabels = df.fields.find((field) => { var _a; return (_a = field.labels) === null || _a === void 0 ? void 0 : _a['span_name']; });
            if (spanNameLabels) {
                labels.push((_a = spanNameLabels.labels) === null || _a === void 0 ? void 0 : _a['span_name']);
            }
        });
    }
    const spanNames = getEscapedSpanNames(labels);
    if (spanNames.length > 0) {
        errorRateBySpanName = buildExpr(errorRateMetric, 'span_name=~"' + spanNames.join('|') + '"', request);
        serviceGraphViewMetrics.push(errorRateBySpanName);
        spanNames.map((name) => {
            const metric = buildExpr(durationMetric, 'span_name=~"' + name + '"', request);
            durationsBySpanName.push(metric);
            serviceGraphViewMetrics.push(metric);
        });
    }
    const serviceMapRequest = makePromServiceMapRequest(request);
    serviceMapRequest.targets = makeServiceGraphViewRequest(serviceGraphViewMetrics);
    return queryPrometheus(serviceMapRequest, datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(), map((errorAndDurationResponse) => {
        var _a;
        const errorRes = errorAndDurationResponse.find((res) => !!res.error);
        if (errorRes) {
            throw new Error(getErrorMessage((_a = errorRes.error) === null || _a === void 0 ? void 0 : _a.message));
        }
        const serviceGraphView = getServiceGraphView(request, rateResponse, errorAndDurationResponse[0], errorRateBySpanName, durationsBySpanName, datasourceUid, tempoDatasourceUid);
        if (serviceGraphView.fields.length === 0) {
            return {
                data: [rateResponse.nodes, rateResponse.edges],
                state: LoadingState.Done,
            };
        }
        return {
            data: [serviceGraphView, rateResponse.nodes, rateResponse.edges],
            state: LoadingState.Done,
        };
    }));
}
function makePromLink(title, expr, datasourceUid, instant) {
    var _a, _b;
    return {
        url: '',
        title,
        internal: {
            query: {
                expr: expr,
                range: !instant,
                exemplar: !instant,
                instant: instant,
            },
            datasourceUid,
            datasourceName: (_b = (_a = getDatasourceSrv().getDataSourceSettingsByUid(datasourceUid)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
        },
    };
}
export function getEscapedSpanNames(values) {
    return values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'));
}
export function getFieldConfig(datasourceUid, tempoDatasourceUid, targetField, tempoField, sourceField, namespaceFields) {
    let source = sourceField ? `client="\${${sourceField}}",` : '';
    let target = `server="\${${targetField}}"`;
    let serverSumBy = 'server';
    if (namespaceFields !== undefined) {
        const { targetNamespace } = namespaceFields;
        target += `,server_service_namespace="\${${targetNamespace}}"`;
        serverSumBy += ', server_service_namespace';
        if (source) {
            const { sourceNamespace } = namespaceFields;
            source += `client_service_namespace="\${${sourceNamespace}}",`;
            serverSumBy += ', client_service_namespace';
        }
    }
    return {
        links: [
            makePromLink('Request rate', `sum by (client, ${serverSumBy})(rate(${totalsMetric}{${source}${target}}[$__rate_interval]))`, datasourceUid, false),
            makePromLink('Request histogram', `histogram_quantile(0.9, sum(rate(${histogramMetric}{${source}${target}}[$__rate_interval])) by (le, client, ${serverSumBy}))`, datasourceUid, false),
            makePromLink('Failed request rate', `sum by (client, ${serverSumBy})(rate(${failedMetric}{${source}${target}}[$__rate_interval]))`, datasourceUid, false),
            makeTempoLink('View traces', `\${${tempoField}}`, '', tempoDatasourceUid),
        ],
    };
}
export function makeTempoLink(title, serviceName, spanName, datasourceUid) {
    var _a, _b;
    let query = { refId: 'A', queryType: 'traceqlSearch', filters: [] };
    if (serviceName !== '') {
        query.filters.push({
            id: 'service-name',
            scope: TraceqlSearchScope.Resource,
            tag: 'service.name',
            value: serviceName,
            operator: '=',
            valueType: 'string',
        });
    }
    if (spanName !== '') {
        query.filters.push({
            id: 'span-name',
            scope: TraceqlSearchScope.Span,
            tag: 'name',
            value: spanName,
            operator: '=',
            valueType: 'string',
        });
    }
    return {
        url: '',
        title,
        internal: {
            query,
            datasourceUid,
            datasourceName: (_b = (_a = getDatasourceSrv().getDataSourceSettingsByUid(datasourceUid)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
        },
    };
}
function makePromServiceMapRequest(options) {
    return Object.assign(Object.assign({}, options), { targets: serviceMapMetrics.map((metric) => {
            const { serviceMapQuery, serviceMapIncludeNamespace: serviceMapIncludeNamespace } = options.targets[0];
            const extraSumByFields = serviceMapIncludeNamespace ? ', client_service_namespace, server_service_namespace' : '';
            return {
                format: 'table',
                refId: metric,
                // options.targets[0] is not correct here, but not sure what should happen if you have multiple queries for
                // service map at the same time anyway
                expr: `sum by (client, server${extraSumByFields}) (rate(${metric}${serviceMapQuery || ''}[$__range]))`,
                instant: true,
            };
        }) });
}
function getServiceGraphView(request, rateResponse, secondResponse, errorRateBySpanName, durationsBySpanName, datasourceUid, tempoDatasourceUid) {
    var _a, _b, _c, _d, _e, _f;
    let df = { fields: [] };
    const rate = rateResponse.rates.filter((x) => {
        return x.refId === buildExpr(rateMetric, defaultTableFilter, request);
    });
    const errorRate = secondResponse.data.filter((x) => {
        return x.refId === errorRateBySpanName;
    });
    const duration = secondResponse.data.filter((x) => {
        var _a;
        return durationsBySpanName.includes((_a = x.refId) !== null && _a !== void 0 ? _a : '');
    });
    if (rate.length > 0 && ((_a = rate[0].fields) === null || _a === void 0 ? void 0 : _a.length) > 2) {
        df.fields.push(Object.assign(Object.assign({}, rate[0].fields[1]), { name: 'Name', config: {
                filterable: false,
            } }));
        df.fields.push(Object.assign(Object.assign({}, rate[0].fields[2]), { name: 'Rate', config: {
                links: [
                    makePromLink('Rate', buildLinkExpr(buildExpr(rateMetric, 'span_name="${__data.fields[0]}"', request)), datasourceUid, false),
                ],
                decimals: 2,
            } }));
        df.fields.push(Object.assign(Object.assign({}, rate[0].fields[2]), { name: '  ', labels: null, config: {
                color: {
                    mode: 'continuous-BlPu',
                },
                custom: {
                    cellOptions: {
                        mode: BarGaugeDisplayMode.Lcd,
                        type: TableCellDisplayMode.Gauge,
                    },
                },
                decimals: 3,
            } }));
    }
    if (errorRate.length > 0 && ((_b = errorRate[0].fields) === null || _b === void 0 ? void 0 : _b.length) > 2) {
        const errorRateNames = (_d = (_c = errorRate[0].fields[1]) === null || _c === void 0 ? void 0 : _c.values) !== null && _d !== void 0 ? _d : [];
        const errorRateValues = (_f = (_e = errorRate[0].fields[2]) === null || _e === void 0 ? void 0 : _e.values) !== null && _f !== void 0 ? _f : [];
        let errorRateObj = {};
        errorRateNames.map((name, index) => {
            errorRateObj[name] = { value: errorRateValues[index] };
        });
        const values = getRateAlignedValues(Object.assign({}, rate), errorRateObj);
        df.fields.push(Object.assign(Object.assign({}, errorRate[0].fields[2]), { name: 'Error Rate', values: values, config: {
                links: [
                    makePromLink('Error Rate', buildLinkExpr(buildExpr(errorRateMetric, 'span_name="${__data.fields[0]}"', request)), datasourceUid, false),
                ],
                decimals: 2,
            } }));
        df.fields.push(Object.assign(Object.assign({}, errorRate[0].fields[2]), { name: '   ', values: values, labels: null, config: {
                color: {
                    mode: 'continuous-RdYlGr',
                },
                custom: {
                    cellOptions: {
                        mode: BarGaugeDisplayMode.Lcd,
                        type: TableCellDisplayMode.Gauge,
                    },
                },
                decimals: 3,
            } }));
    }
    if (duration.length > 0) {
        let durationObj = {};
        duration.forEach((d) => {
            var _a, _b;
            if (d.fields.length > 1) {
                const delimiter = ((_a = d.refId) === null || _a === void 0 ? void 0 : _a.includes('span_name=~"')) ? 'span_name=~"' : 'span_name="';
                const name = (_b = d.refId) === null || _b === void 0 ? void 0 : _b.split(delimiter)[1].split('"}')[0];
                durationObj[name] = { value: d.fields[1].values[0] };
            }
        });
        if (Object.keys(durationObj).length > 0) {
            df.fields.push(Object.assign(Object.assign({}, duration[0].fields[1]), { name: 'Duration (p90)', values: getRateAlignedValues(Object.assign({}, rate), durationObj), config: {
                    links: [
                        makePromLink('Duration', buildLinkExpr(buildExpr(durationMetric, 'span_name="${__data.fields[0]}"', request)), datasourceUid, false),
                    ],
                    unit: 's',
                } }));
        }
    }
    if (df.fields.length > 0 && df.fields[0].values) {
        df.fields.push({
            name: 'Links',
            type: FieldType.string,
            values: df.fields[0].values.map(() => {
                return 'Tempo';
            }),
            config: {
                links: [makeTempoLink('Tempo', '', `\${__data.fields[0]}`, tempoDatasourceUid)],
            },
        });
    }
    return df;
}
export function buildExpr(metric, extraParams, request) {
    var _a, _b;
    let serviceMapQuery = (_b = (_a = request.targets[0]) === null || _a === void 0 ? void 0 : _a.serviceMapQuery) !== null && _b !== void 0 ? _b : '';
    const serviceMapQueryMatch = serviceMapQuery.match(/^{(.*)}$/);
    if (serviceMapQueryMatch === null || serviceMapQueryMatch === void 0 ? void 0 : serviceMapQueryMatch.length) {
        serviceMapQuery = serviceMapQueryMatch[1];
    }
    // map serviceGraph metric tags to serviceGraphView metric tags
    serviceMapQuery = serviceMapQuery.replace('client', 'service').replace('server', 'service');
    const metricParams = serviceMapQuery.includes('span_name')
        ? metric.params.concat(serviceMapQuery)
        : metric.params
            .concat(serviceMapQuery)
            .concat(extraParams)
            .filter((item) => item);
    return metric.expr.replace('{}', '{' + metricParams.join(',') + '}');
}
export function buildLinkExpr(expr) {
    // don't want top 5 or by span name in links
    expr = expr.replace('topk(5, ', '').replace(' by (span_name))', '');
    return expr.replace('__range', '__rate_interval');
}
// query result frames can come back in any order
// here we align the table col values to the same row name (rateName) across the table
export function getRateAlignedValues(rateResp, objToAlign) {
    var _a, _b, _c;
    const rateNames = (_c = (_b = (_a = rateResp[0]) === null || _a === void 0 ? void 0 : _a.fields[1]) === null || _b === void 0 ? void 0 : _b.values) !== null && _c !== void 0 ? _c : [];
    let values = [];
    for (let i = 0; i < rateNames.length; i++) {
        if (Object.keys(objToAlign).includes(rateNames[i])) {
            values.push(objToAlign[rateNames[i]].value);
        }
        else {
            values.push('0');
        }
    }
    return values;
}
export function makeServiceGraphViewRequest(metrics) {
    return metrics.map((metric) => {
        return {
            refId: metric,
            expr: metric,
            instant: true,
        };
    });
}
//# sourceMappingURL=datasource.js.map