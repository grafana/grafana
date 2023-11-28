import { __awaiter, __rest } from "tslib";
import { cloneDeep, map as lodashMap } from 'lodash';
import { lastValueFrom, merge, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { CoreApp, DataFrameView, SupplementaryQueryType, FieldCache, FieldType, LoadingState, LogLevel, rangeUtil, renderLegendFormat, } from '@grafana/data';
import { intervalToMs } from '@grafana/data/src/datetime/rangeutil';
import { Duration } from '@grafana/lezer-logql';
import { config, DataSourceWithBackend } from '@grafana/runtime';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { serializeParams } from '../../../core/utils/fetch';
import { queryLogsSample, queryLogsVolume } from '../../../features/logs/logsModel';
import { getLogLevelFromKey } from '../../../features/logs/utils';
import { replaceVariables, returnVariables } from '../prometheus/querybuilder/shared/parsingUtils';
import LanguageProvider from './LanguageProvider';
import { LiveStreams } from './LiveStreams';
import { LogContextProvider } from './LogContextProvider';
import { transformBackendResult } from './backendResultTransformer';
import { LokiAnnotationsQueryEditor } from './components/AnnotationsQueryEditor';
import { placeHolderScopedVars } from './components/monaco-query-field/monaco-completion-provider/validation';
import { escapeLabelValueInSelector, isRegexSelector } from './languageUtils';
import { labelNamesRegex, labelValuesRegex } from './migrations/variableQueryMigrations';
import { addLabelFormatToQuery, addLabelToQuery, addNoPipelineErrorToQuery, addParserToQuery, removeCommentsFromQuery, addFilterAsLabelFilter, getParserPositions, toLabelFilter, addLineFilter, findLastPosition, getLabelFilterPositions, queryHasFilter, removeLabelFromQuery, } from './modifyQuery';
import { getQueryHints } from './queryHints';
import { runSplitQuery } from './querySplitting';
import { getLogQueryFromMetricsQuery, getLokiQueryFromDataQuery, getNodesFromQuery, getNormalizedLokiQuery, getStreamSelectorsFromQuery, isLogsQuery, isQueryWithError, requestSupportsSplitting, } from './queryUtils';
import { doLokiChannelStream } from './streaming';
import { trackQuery } from './tracking';
import { LokiQueryType, LokiVariableQueryType, SupportingQueryType, } from './types';
import { LokiVariableSupport } from './variables';
export const DEFAULT_MAX_LINES = 1000;
export const LOKI_ENDPOINT = '/loki/api/v1';
export const REF_ID_DATA_SAMPLES = 'loki-data-samples';
export const REF_ID_STARTER_ANNOTATION = 'annotation-';
export const REF_ID_STARTER_LOG_ROW_CONTEXT = 'log-row-context-query-';
export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';
const NS_IN_MS = 1000000;
export function makeRequest(query, range, app, requestId, hideFromInspector) {
    const intervalInfo = rangeUtil.calculateInterval(range, 1);
    return {
        targets: [query],
        requestId,
        interval: intervalInfo.interval,
        intervalMs: intervalInfo.intervalMs,
        range: range,
        scopedVars: {},
        timezone: 'UTC',
        app,
        startTime: Date.now(),
        hideFromInspector,
    };
}
export class LokiDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv(), timeSrv = getTimeSrv()) {
        var _a, _b;
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.streams = new LiveStreams();
        /**
         * Runs live queries which in this case means creating a websocket and listening on it for new logs.
         * This returns a bit different dataFrame than runQueries as it returns single dataframe even if there are multiple
         * Loki streams, sets only common labels on dataframe.labels and has additional dataframe.fields.labels for unique
         * labels per row.
         */
        this.runLiveQuery = (target, maxDataPoints) => {
            const liveTarget = this.createLiveTarget(target, maxDataPoints);
            return this.streams.getStream(liveTarget).pipe(map((data) => ({
                data: data || [],
                key: `loki-${liveTarget.refId}`,
                state: LoadingState.Streaming,
            })), catchError((err) => {
                return throwError(() => `Live tailing was stopped due to following error: ${err.reason}`);
            }));
        };
        this.getLogRowContext = (row, options, origQuery) => __awaiter(this, void 0, void 0, function* () {
            return yield this.logContextProvider.getLogRowContext(row, options, getLokiQueryFromDataQuery(origQuery));
        });
        this.getLogRowContextQuery = (row, options, origQuery) => __awaiter(this, void 0, void 0, function* () {
            return yield this.logContextProvider.getLogRowContextQuery(row, options, getLokiQueryFromDataQuery(origQuery));
        });
        this.languageProvider = new LanguageProvider(this);
        const settingsData = instanceSettings.jsonData || {};
        this.maxLines = parseInt((_a = settingsData.maxLines) !== null && _a !== void 0 ? _a : '0', 10) || DEFAULT_MAX_LINES;
        this.predefinedOperations = (_b = settingsData.predefinedOperations) !== null && _b !== void 0 ? _b : '';
        this.annotations = {
            QueryEditor: LokiAnnotationsQueryEditor,
        };
        this.variables = new LokiVariableSupport(this);
        this.logContextProvider = new LogContextProvider(this);
    }
    getDataProvider(type, request) {
        if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
            return undefined;
        }
        switch (type) {
            case SupplementaryQueryType.LogsVolume:
                return this.getLogsVolumeDataProvider(request);
            case SupplementaryQueryType.LogsSample:
                return this.getLogsSampleDataProvider(request);
            default:
                return undefined;
        }
    }
    getSupportedSupplementaryQueryTypes() {
        return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
    }
    getSupplementaryQuery(options, query) {
        if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
            return undefined;
        }
        const normalizedQuery = getNormalizedLokiQuery(query);
        const expr = removeCommentsFromQuery(normalizedQuery.expr);
        let isQuerySuitable = false;
        switch (options.type) {
            case SupplementaryQueryType.LogsVolume:
                // it has to be a logs-producing range-query
                isQuerySuitable = !!(expr && isLogsQuery(expr) && normalizedQuery.queryType === LokiQueryType.Range);
                if (!isQuerySuitable) {
                    return undefined;
                }
                return Object.assign(Object.assign({}, normalizedQuery), { refId: `${REF_ID_STARTER_LOG_VOLUME}${normalizedQuery.refId}`, queryType: LokiQueryType.Range, supportingQueryType: SupportingQueryType.LogsVolume, expr: `sum by (level) (count_over_time(${expr}[$__auto]))` });
            case SupplementaryQueryType.LogsSample:
                // it has to be a metric query
                isQuerySuitable = !!(expr && !isLogsQuery(expr));
                if (!isQuerySuitable) {
                    return undefined;
                }
                return Object.assign(Object.assign({}, normalizedQuery), { queryType: LokiQueryType.Range, refId: `${REF_ID_STARTER_LOG_SAMPLE}${normalizedQuery.refId}`, expr: getLogQueryFromMetricsQuery(expr), maxLines: Number.isNaN(Number(options.limit)) ? this.maxLines : Number(options.limit) });
            default:
                return undefined;
        }
    }
    getLogsVolumeDataProvider(request) {
        const logsVolumeRequest = cloneDeep(request);
        const targets = logsVolumeRequest.targets
            .map((query) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, query))
            .filter((query) => !!query);
        if (!targets.length) {
            return undefined;
        }
        return queryLogsVolume(this, Object.assign(Object.assign({}, logsVolumeRequest), { targets }), {
            extractLevel,
            range: request.range,
            targets: request.targets,
        });
    }
    getLogsSampleDataProvider(request) {
        const logsSampleRequest = cloneDeep(request);
        const targets = logsSampleRequest.targets
            .map((query) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, query))
            .filter((query) => !!query);
        if (!targets.length) {
            return undefined;
        }
        return queryLogsSample(this, Object.assign(Object.assign({}, logsSampleRequest), { targets }));
    }
    query(request) {
        var _a;
        const queries = request.targets
            .map(getNormalizedLokiQuery) // "fix" the `.queryType` prop
            .map((q) => { var _a; return (Object.assign(Object.assign({}, q), { maxLines: (_a = q.maxLines) !== null && _a !== void 0 ? _a : this.maxLines })); });
        const fixedRequest = Object.assign(Object.assign({}, request), { targets: queries });
        const streamQueries = fixedRequest.targets.filter((q) => q.queryType === LokiQueryType.Stream);
        if (config.featureToggles.lokiExperimentalStreaming &&
            streamQueries.length > 0 &&
            ((_a = fixedRequest.rangeRaw) === null || _a === void 0 ? void 0 : _a.to) === 'now') {
            // this is still an in-development feature,
            // we do not support mixing stream-queries with normal-queries for now.
            const streamRequest = Object.assign(Object.assign({}, fixedRequest), { targets: streamQueries });
            return merge(...streamQueries.map((q) => doLokiChannelStream(this.applyTemplateVariables(q, request.scopedVars), this, // the datasource
            streamRequest)));
        }
        if (fixedRequest.liveStreaming) {
            return this.runLiveQueryThroughBackend(fixedRequest);
        }
        if (config.featureToggles.lokiQuerySplitting && requestSupportsSplitting(fixedRequest.targets)) {
            return runSplitQuery(this, fixedRequest);
        }
        const startTime = new Date();
        return this.runQuery(fixedRequest).pipe(tap((response) => trackQuery(response, fixedRequest, startTime, { predefinedOperations: this.predefinedOperations })));
    }
    runQuery(fixedRequest) {
        return super
            .query(fixedRequest)
            .pipe(map((response) => { var _a; return transformBackendResult(response, fixedRequest.targets, (_a = this.instanceSettings.jsonData.derivedFields) !== null && _a !== void 0 ? _a : []); }));
    }
    runLiveQueryThroughBackend(request) {
        // this only works in explore-mode, so variables don't need to be handled,
        //  and only for logs-queries, not metric queries
        const logsQueries = request.targets.filter((query) => query.expr !== '' && isLogsQuery(query.expr));
        if (logsQueries.length === 0) {
            return of({
                data: [],
                state: LoadingState.Done,
            });
        }
        const subQueries = logsQueries.map((query) => {
            const maxDataPoints = query.maxLines || this.maxLines;
            // FIXME: currently we are running it through the frontend still.
            return this.runLiveQuery(query, maxDataPoints);
        });
        return merge(...subQueries);
    }
    createLiveTarget(target, maxDataPoints) {
        const query = target.expr;
        const baseUrl = this.instanceSettings.url;
        const params = serializeParams({ query });
        return {
            query,
            url: convertToWebSocketUrl(`${baseUrl}/loki/api/v1/tail?${params}`),
            refId: target.refId,
            size: maxDataPoints,
        };
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        let expandedQueries = queries;
        if (queries && queries.length) {
            expandedQueries = queries.map((query) => (Object.assign(Object.assign({}, query), { datasource: this.getRef(), expr: this.addAdHocFilters(this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr)) })));
        }
        return expandedQueries;
    }
    getQueryDisplayText(query) {
        return query.expr;
    }
    getTimeRange() {
        return this.timeSrv.timeRange();
    }
    getTimeRangeParams() {
        const timeRange = this.getTimeRange();
        return { start: timeRange.from.valueOf() * NS_IN_MS, end: timeRange.to.valueOf() * NS_IN_MS };
    }
    importFromAbstractQueries(abstractQueries) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.languageProvider.start();
            const existingKeys = this.languageProvider.labelKeys;
            if (existingKeys && existingKeys.length) {
                abstractQueries = abstractQueries.map((abstractQuery) => {
                    abstractQuery.labelMatchers = abstractQuery.labelMatchers.filter((labelMatcher) => {
                        return existingKeys.includes(labelMatcher.name);
                    });
                    return abstractQuery;
                });
            }
            return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
        });
    }
    exportToAbstractQueries(queries) {
        return __awaiter(this, void 0, void 0, function* () {
            return queries.map((query) => this.languageProvider.exportToAbstractQuery(query));
        });
    }
    metadataRequest(url, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // url must not start with a `/`, otherwise the AJAX-request
            // going from the browser will contain `//`, which can cause problems.
            if (url.startsWith('/')) {
                throw new Error(`invalid metadata request url: ${url}`);
            }
            const res = yield this.getResource(url, params, options);
            return res.data || [];
        });
    }
    // We need a specific metadata method for stats endpoint as it does not return res.data,
    // but it returns stats directly in res object.
    statsMetadataRequest(url, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (url.startsWith('/')) {
                throw new Error(`invalid metadata request url: ${url}`);
            }
            return yield this.getResource(url, params, options);
        });
    }
    getQueryStats(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // if query is invalid, clear stats, and don't request
            if (isQueryWithError(this.interpolateString(query.expr, placeHolderScopedVars))) {
                return undefined;
            }
            const labelMatchers = getStreamSelectorsFromQuery(query.expr);
            let statsForAll = { streams: 0, chunks: 0, bytes: 0, entries: 0 };
            for (const idx in labelMatchers) {
                const { start, end } = this.getStatsTimeRange(query, Number(idx));
                if (start === undefined || end === undefined) {
                    return { streams: 0, chunks: 0, bytes: 0, entries: 0, message: 'Query size estimate not available.' };
                }
                try {
                    const data = yield this.statsMetadataRequest('index/stats', {
                        query: labelMatchers[idx],
                        start: start,
                        end: end,
                    }, { showErrorAlert: false });
                    statsForAll = {
                        streams: statsForAll.streams + data.streams,
                        chunks: statsForAll.chunks + data.chunks,
                        bytes: statsForAll.bytes + data.bytes,
                        entries: statsForAll.entries + data.entries,
                    };
                }
                catch (e) {
                    break;
                }
            }
            return statsForAll;
        });
    }
    getStatsTimeRange(query, idx) {
        let start, end;
        const NS_IN_MS = 1000000;
        const durationNodes = getNodesFromQuery(query.expr, [Duration]);
        const durations = durationNodes.map((d) => query.expr.substring(d.from, d.to));
        if (isLogsQuery(query.expr)) {
            // logs query with instant type can not be estimated
            if (query.queryType === LokiQueryType.Instant) {
                return { start: undefined, end: undefined };
            }
            // logs query with range type
            return this.getTimeRangeParams();
        }
        if (query.queryType === LokiQueryType.Instant) {
            // metric query with instant type
            if (!!durations[idx]) {
                // if query has a duration e.g. [1m]
                end = this.getTimeRangeParams().end;
                start = end - intervalToMs(durations[idx]) * NS_IN_MS;
                return { start, end };
            }
            else {
                // if query has no duration e.g. [$__interval]
                if (/(\$__auto|\$__range)/.test(query.expr)) {
                    // if $__auto or $__range is used, we can estimate the time range using the selected range
                    return this.getTimeRangeParams();
                }
                // otherwise we cant estimate the time range
                return { start: undefined, end: undefined };
            }
        }
        // metric query with range type
        return this.getTimeRangeParams();
    }
    getStats(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query) {
                return null;
            }
            const response = yield this.getQueryStats(query);
            if (!response) {
                return null;
            }
            return Object.values(response).every((v) => v === 0) ? null : response;
        });
    }
    metricFindQuery(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query) {
                return Promise.resolve([]);
            }
            if (typeof query === 'string') {
                const interpolated = this.interpolateString(query, options === null || options === void 0 ? void 0 : options.scopedVars);
                return yield this.legacyProcessMetricFindQuery(interpolated);
            }
            const interpolatedQuery = Object.assign(Object.assign({}, query), { label: this.interpolateString(query.label || '', options === null || options === void 0 ? void 0 : options.scopedVars), stream: this.interpolateString(query.stream || '', options === null || options === void 0 ? void 0 : options.scopedVars) });
            return yield this.processMetricFindQuery(interpolatedQuery);
        });
    }
    processMetricFindQuery(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (query.type === LokiVariableQueryType.LabelNames) {
                return this.labelNamesQuery();
            }
            if (!query.label) {
                return [];
            }
            // If we have stream selector, use /series endpoint
            if (query.stream) {
                return this.labelValuesSeriesQuery(query.stream, query.label);
            }
            return this.labelValuesQuery(query.label);
        });
    }
    legacyProcessMetricFindQuery(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const labelNames = query.match(labelNamesRegex);
            if (labelNames) {
                return yield this.labelNamesQuery();
            }
            const labelValues = query.match(labelValuesRegex);
            if (labelValues) {
                // If we have stream selector, use /series endpoint
                if (labelValues[1]) {
                    return yield this.labelValuesSeriesQuery(labelValues[1], labelValues[2]);
                }
                return yield this.labelValuesQuery(labelValues[2]);
            }
            return Promise.resolve([]);
        });
    }
    labelNamesQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = 'labels';
            const params = this.getTimeRangeParams();
            const result = yield this.metadataRequest(url, params);
            return result.map((value) => ({ text: value }));
        });
    }
    labelValuesQuery(label) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = this.getTimeRangeParams();
            const url = `label/${label}/values`;
            const result = yield this.metadataRequest(url, params);
            return result.map((value) => ({ text: value }));
        });
    }
    labelValuesSeriesQuery(expr, label) {
        return __awaiter(this, void 0, void 0, function* () {
            const timeParams = this.getTimeRangeParams();
            const params = Object.assign(Object.assign({}, timeParams), { 'match[]': expr });
            const url = 'series';
            const streams = new Set();
            const result = yield this.metadataRequest(url, params);
            result.forEach((stream) => {
                if (stream[label]) {
                    streams.add({ text: stream[label] });
                }
            });
            return Array.from(streams);
        });
    }
    getDataSamples(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // Currently works only for logs sample
            if (!isLogsQuery(query.expr) || isQueryWithError(this.interpolateString(query.expr, placeHolderScopedVars))) {
                return [];
            }
            const lokiLogsQuery = {
                expr: query.expr,
                queryType: LokiQueryType.Range,
                refId: REF_ID_DATA_SAMPLES,
                // For samples we limit the request to 10 lines, so queries are small and fast
                maxLines: 10,
            };
            const timeRange = this.getTimeRange();
            const request = makeRequest(lokiLogsQuery, timeRange, CoreApp.Unknown, REF_ID_DATA_SAMPLES, true);
            return yield lastValueFrom(this.query(request).pipe(switchMap((res) => of(res.data))));
        });
    }
    // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
    getTagKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.labelNamesQuery();
        });
    }
    getTagValues(options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.labelValuesQuery(options.key);
        });
    }
    interpolateQueryExpr(value, variable) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return lokiRegularEscape(value);
        }
        if (typeof value === 'string') {
            return lokiSpecialRegexEscape(value);
        }
        const escapedValues = lodashMap(value, lokiSpecialRegexEscape);
        return escapedValues.join('|');
    }
    toggleQueryFilter(query, filter) {
        var _a, _b, _c, _d, _e;
        let expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        switch (filter.type) {
            case 'FILTER_FOR': {
                if (((_b = filter.options) === null || _b === void 0 ? void 0 : _b.key) && ((_c = filter.options) === null || _c === void 0 ? void 0 : _c.value)) {
                    const value = escapeLabelValueInSelector(filter.options.value);
                    // This gives the user the ability to toggle a filter on and off.
                    expression = queryHasFilter(expression, filter.options.key, '=', value)
                        ? removeLabelFromQuery(expression, filter.options.key, '=', value)
                        : addLabelToQuery(expression, filter.options.key, '=', value);
                }
                break;
            }
            case 'FILTER_OUT': {
                if (((_d = filter.options) === null || _d === void 0 ? void 0 : _d.key) && ((_e = filter.options) === null || _e === void 0 ? void 0 : _e.value)) {
                    const value = escapeLabelValueInSelector(filter.options.value);
                    /**
                     * If there is a filter with the same key and value, remove it.
                     * This prevents the user from seeing no changes in the query when they apply
                     * this filter.
                     */
                    if (queryHasFilter(expression, filter.options.key, '=', value)) {
                        expression = removeLabelFromQuery(expression, filter.options.key, '=', value);
                    }
                    expression = addLabelToQuery(expression, filter.options.key, '!=', value);
                }
                break;
            }
            default:
                break;
        }
        return Object.assign(Object.assign({}, query), { expr: expression });
    }
    queryHasFilter(query, filter) {
        var _a;
        let expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        return queryHasFilter(expression, filter.key, '=', filter.value);
    }
    modifyQuery(query, action) {
        var _a, _b, _c, _d, _e, _f, _g;
        let expression = (_a = query.expr) !== null && _a !== void 0 ? _a : '';
        // NB: Usually the labelKeys should be fetched and cached in the datasource,
        // but there might be some edge cases where this wouldn't be the case.
        // However the changed would make this method `async`.
        const allLabels = this.languageProvider.getLabelKeys();
        switch (action.type) {
            case 'ADD_FILTER': {
                if (((_b = action.options) === null || _b === void 0 ? void 0 : _b.key) && ((_c = action.options) === null || _c === void 0 ? void 0 : _c.value)) {
                    const value = escapeLabelValueInSelector(action.options.value);
                    expression = addLabelToQuery(expression, action.options.key, '=', value, allLabels.includes(action.options.key) === false);
                }
                break;
            }
            case 'ADD_FILTER_OUT': {
                if (((_d = action.options) === null || _d === void 0 ? void 0 : _d.key) && ((_e = action.options) === null || _e === void 0 ? void 0 : _e.value)) {
                    const value = escapeLabelValueInSelector(action.options.value);
                    expression = addLabelToQuery(expression, action.options.key, '!=', value, allLabels.includes(action.options.key) === false);
                }
                break;
            }
            case 'ADD_LOGFMT_PARSER': {
                expression = addParserToQuery(expression, 'logfmt');
                break;
            }
            case 'ADD_JSON_PARSER': {
                expression = addParserToQuery(expression, 'json');
                break;
            }
            case 'ADD_UNPACK_PARSER': {
                expression = addParserToQuery(expression, 'unpack');
                break;
            }
            case 'ADD_NO_PIPELINE_ERROR': {
                expression = addNoPipelineErrorToQuery(expression);
                break;
            }
            case 'ADD_LEVEL_LABEL_FORMAT': {
                if (((_f = action.options) === null || _f === void 0 ? void 0 : _f.originalLabel) && ((_g = action.options) === null || _g === void 0 ? void 0 : _g.renameTo)) {
                    expression = addLabelFormatToQuery(expression, {
                        renameTo: action.options.renameTo,
                        originalLabel: action.options.originalLabel,
                    });
                }
                break;
            }
            case 'ADD_LABEL_FILTER': {
                const parserPositions = getParserPositions(query.expr);
                const labelFilterPositions = getLabelFilterPositions(query.expr);
                const lastPosition = findLastPosition([...parserPositions, ...labelFilterPositions]);
                const filter = toLabelFilter('', '', '=');
                expression = addFilterAsLabelFilter(expression, [lastPosition], filter);
                break;
            }
            case 'ADD_LINE_FILTER': {
                expression = addLineFilter(expression);
                break;
            }
            default:
                break;
        }
        return Object.assign(Object.assign({}, query), { expr: expression });
    }
    getLogRowContextUi(row, runContextQuery, origQuery) {
        return this.logContextProvider.getLogRowContextUi(row, runContextQuery, getLokiQueryFromDataQuery(origQuery));
    }
    annotationQuery(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { expr, maxLines, instant, tagKeys = '', titleFormat = '', textFormat = '' } = options.annotation;
            if (!expr) {
                return [];
            }
            const id = `${REF_ID_STARTER_ANNOTATION}${options.annotation.name}`;
            const query = {
                refId: id,
                expr,
                maxLines,
                instant,
                queryType: instant ? LokiQueryType.Instant : LokiQueryType.Range,
            };
            const request = makeRequest(query, options.range, CoreApp.Dashboard, id);
            const { data } = yield lastValueFrom(this.query(request));
            const annotations = [];
            const splitKeys = tagKeys.split(',').filter((v) => v !== '');
            for (const frame of data) {
                const view = new DataFrameView(frame);
                view.forEach((row) => {
                    const { labels } = row;
                    const maybeDuplicatedTags = Object.entries(labels)
                        .map(([key, val]) => [key, val.trim()]) // trim all label-values
                        .filter(([key, val]) => {
                        if (val === '') {
                            // remove empty
                            return false;
                        }
                        // if tags are specified, remove label if does not match tags
                        if (splitKeys.length && !splitKeys.includes(key)) {
                            return false;
                        }
                        return true;
                    })
                        .map(([key, val]) => val); // keep only the label-value
                    // remove duplicates
                    const tags = Array.from(new Set(maybeDuplicatedTags));
                    annotations.push({
                        time: new Date(row.Time).valueOf(),
                        title: renderLegendFormat(titleFormat, labels),
                        text: renderLegendFormat(textFormat, labels) || row.Line,
                        tags,
                    });
                });
            }
            return annotations;
        });
    }
    showContextToggle(row) {
        return true;
    }
    addAdHocFilters(queryExpr) {
        const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        let expr = replaceVariables(queryExpr);
        expr = adhocFilters.reduce((acc, filter) => {
            const { key, operator } = filter;
            let { value } = filter;
            if (isRegexSelector(operator)) {
                // Adhoc filters don't support multiselect, therefore if user selects regex operator
                // we are going to consider value to be regex filter and use lokiRegularEscape
                // that does not escape regex special characters (e.g. .*test.* => .*test.*)
                value = lokiRegularEscape(value);
            }
            else {
                // Otherwise, we want to escape special characters in value
                value = escapeLabelValueInSelector(value, operator);
            }
            return addLabelToQuery(acc, key, operator, value);
        }, expr);
        return returnVariables(expr);
    }
    // Used when running queries through backend
    filterQuery(query) {
        if (query.hide || query.expr === '') {
            return false;
        }
        return true;
    }
    // Used when running queries through backend
    applyTemplateVariables(target, scopedVars) {
        // We want to interpolate these variables on backend because we support using them in
        // alerting/ML queries and we want to have consistent interpolation for all queries
        const _a = scopedVars || {}, { __auto, __interval, __interval_ms, __range, __range_s, __range_ms } = _a, rest = __rest(_a, ["__auto", "__interval", "__interval_ms", "__range", "__range_s", "__range_ms"]);
        const exprWithAdHoc = this.addAdHocFilters(target.expr);
        return Object.assign(Object.assign({}, target), { legendFormat: this.templateSrv.replace(target.legendFormat, rest), expr: this.templateSrv.replace(exprWithAdHoc, rest, this.interpolateQueryExpr) });
    }
    interpolateString(string, scopedVars) {
        return this.templateSrv.replace(string, scopedVars, this.interpolateQueryExpr);
    }
    getVariables() {
        return this.templateSrv.getVariables().map((v) => `$${v.name}`);
    }
    getQueryHints(query, result) {
        return getQueryHints(query.expr, result);
    }
    getDefaultQuery(app) {
        const defaults = { refId: 'A', expr: '' };
        if (app === CoreApp.UnifiedAlerting) {
            return Object.assign(Object.assign({}, defaults), { queryType: LokiQueryType.Instant });
        }
        return Object.assign(Object.assign({}, defaults), { queryType: LokiQueryType.Range });
    }
}
// NOTE: these two functions are very similar to the escapeLabelValueIn* functions
// in language_utils.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.
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
function extractLevel(dataFrame) {
    let valueField;
    try {
        valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
    }
    catch (_a) { }
    return (valueField === null || valueField === void 0 ? void 0 : valueField.labels) ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
}
function getLogLevelFromLabels(labels) {
    const labelNames = ['level', 'lvl', 'loglevel'];
    let levelLabel;
    for (let labelName of labelNames) {
        if (labelName in labels) {
            levelLabel = labelName;
            break;
        }
    }
    return levelLabel ? getLogLevelFromKey(labels[levelLabel]) : LogLevel.unknown;
}
//# sourceMappingURL=datasource.js.map