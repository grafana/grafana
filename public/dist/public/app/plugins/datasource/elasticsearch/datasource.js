import { __awaiter } from "tslib";
import { cloneDeep, find, isNumber, isObject, isString, map as _map } from 'lodash';
import { from, generate, lastValueFrom, of } from 'rxjs';
import { catchError, first, map, mergeMap, skipWhile, throwIfEmpty, tap } from 'rxjs/operators';
import { SemVer } from 'semver';
import { dateTime, getDefaultTimeRange, LogLevel, CoreApp, SupplementaryQueryType, rangeUtil, LogRowContextQueryDirection, toUtc, FieldType, } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv, config } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { queryLogsSample, queryLogsVolume } from '../../../features/logs/logsModel';
import { getLogLevelFromKey } from '../../../features/logs/utils';
import { IndexPattern, intervalMap } from './IndexPattern';
import LanguageProvider from './LanguageProvider';
import { LegacyQueryRunner } from './LegacyQueryRunner';
import { ElasticQueryBuilder } from './QueryBuilder';
import { ElasticsearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import { isBucketAggregationWithField } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import { isMetricAggregationWithField, isPipelineAggregationWithMultipleBucketPaths, } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { isMetricAggregationWithMeta } from './guards';
import { addFilterToQuery, escapeFilter, escapeFilterValue, queryHasFilter, removeFilterFromQuery, } from './modifyQuery';
import { trackAnnotationQuery, trackQuery } from './tracking';
import { getScriptValue, isSupportedVersion, isTimeSeriesQuery, unsupportedVersionMessage } from './utils';
export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';
// Those are metadata fields as defined in https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields.
// custom fields can start with underscores, therefore is not safe to exclude anything that starts with one.
const ELASTIC_META_FIELDS = [
    '_index',
    '_type',
    '_id',
    '_source',
    '_size',
    '_field_names',
    '_ignored',
    '_routing',
    '_meta',
];
export class ElasticDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        var _a, _b, _c;
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.getLogRowContext = (row, options) => __awaiter(this, void 0, void 0, function* () {
            const { enableElasticsearchBackendQuerying } = config.featureToggles;
            if (enableElasticsearchBackendQuerying) {
                const contextRequest = this.makeLogContextDataRequest(row, options);
                return lastValueFrom(this.query(contextRequest).pipe(catchError((err) => {
                    const error = {
                        message: 'Error during context query. Please check JS console logs.',
                        status: err.status,
                        statusText: err.statusText,
                    };
                    throw error;
                })));
            }
            else {
                return this.legacyQueryRunner.logContextQuery(row, options);
            }
        });
        this.makeLogContextDataRequest = (row, options) => {
            var _a, _b;
            const direction = (options === null || options === void 0 ? void 0 : options.direction) || LogRowContextQueryDirection.Backward;
            const logQuery = {
                type: 'logs',
                id: '1',
                settings: {
                    limit: (options === null || options === void 0 ? void 0 : options.limit) ? options === null || options === void 0 ? void 0 : options.limit.toString() : '10',
                    // Sorting of results in the context query
                    sortDirection: direction === LogRowContextQueryDirection.Backward ? 'desc' : 'asc',
                    // Used to get the next log lines before/after the current log line using sort field of selected log line
                    searchAfter: (_b = (_a = row.dataFrame.fields.find((f) => f.name === 'sort')) === null || _a === void 0 ? void 0 : _a.values[row.rowIndex]) !== null && _b !== void 0 ? _b : [row.timeEpochMs],
                },
            };
            const query = {
                refId: `log-context-${row.dataFrame.refId}-${direction}`,
                metrics: [logQuery],
                query: '',
            };
            const timeRange = createContextTimeRange(row.timeEpochMs, direction, this.intervalPattern);
            const range = {
                from: timeRange.from,
                to: timeRange.to,
                raw: timeRange,
            };
            const interval = rangeUtil.calculateInterval(range, 1);
            const contextRequest = {
                requestId: `log-context-request-${row.dataFrame.refId}-${options === null || options === void 0 ? void 0 : options.direction}`,
                targets: [query],
                interval: interval.interval,
                intervalMs: interval.intervalMs,
                range,
                scopedVars: {},
                timezone: 'UTC',
                app: CoreApp.Explore,
                startTime: Date.now(),
                hideFromInspector: true,
            };
            return contextRequest;
        };
        this.basicAuth = instanceSettings.basicAuth;
        this.withCredentials = instanceSettings.withCredentials;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.isProxyAccess = instanceSettings.access === 'proxy';
        const settingsData = instanceSettings.jsonData || {};
        this.index = (_b = (_a = settingsData.index) !== null && _a !== void 0 ? _a : instanceSettings.database) !== null && _b !== void 0 ? _b : '';
        this.timeField = settingsData.timeField;
        this.xpack = Boolean(settingsData.xpack);
        this.indexPattern = new IndexPattern(this.index, settingsData.interval);
        this.intervalPattern = settingsData.interval;
        this.interval = settingsData.timeInterval;
        this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
        this.queryBuilder = new ElasticQueryBuilder({
            timeField: this.timeField,
        });
        this.logMessageField = settingsData.logMessageField || '';
        this.logLevelField = settingsData.logLevelField || '';
        this.dataLinks = settingsData.dataLinks || [];
        this.includeFrozen = (_c = settingsData.includeFrozen) !== null && _c !== void 0 ? _c : false;
        this.databaseVersion = null;
        this.annotations = {
            QueryEditor: ElasticsearchAnnotationsQueryEditor,
        };
        if (this.logMessageField === '') {
            this.logMessageField = undefined;
        }
        if (this.logLevelField === '') {
            this.logLevelField = undefined;
        }
        this.languageProvider = new LanguageProvider(this);
        this.timeSrv = getTimeSrv();
        this.legacyQueryRunner = new LegacyQueryRunner(this, this.templateSrv);
    }
    getResourceRequest(path, params, options) {
        return this.getResource(path, params, options);
    }
    postResourceRequest(path, data, options) {
        var _a;
        const resourceOptions = options !== null && options !== void 0 ? options : {};
        resourceOptions.headers = (_a = resourceOptions.headers) !== null && _a !== void 0 ? _a : {};
        resourceOptions.headers['content-type'] = 'application/x-ndjson';
        return this.postResource(path, data, resourceOptions);
    }
    importFromAbstractQueries(abstractQueries) {
        return __awaiter(this, void 0, void 0, function* () {
            return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
        });
    }
    /**
     * Sends a GET request to the specified url on the newest matching and available index.
     *
     * When multiple indices span the provided time range, the request is sent starting from the newest index,
     * and then going backwards until an index is found.
     *
     * @param url the url to query the index on, for example `/_mapping`.
     */
    requestAllIndices(url, range = getDefaultTimeRange()) {
        let indexList = this.indexPattern.getIndexList(range.from, range.to);
        if (!Array.isArray(indexList)) {
            indexList = [this.indexPattern.getIndexForToday()];
        }
        const indexUrlList = indexList.map((index) => index + url);
        const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
        const listLen = indexUrlList.length;
        return generate({
            initialState: 0,
            condition: (i) => i < Math.min(listLen, maxTraversals),
            iterate: (i) => i + 1,
        }).pipe(mergeMap((index) => {
            // catch all errors and emit an object with an err property to simplify checks later in the pipeline
            const path = indexUrlList[listLen - index - 1];
            const requestObservable = config.featureToggles.enableElasticsearchBackendQuerying
                ? from(this.getResource(path))
                : this.legacyQueryRunner.request('GET', path);
            return requestObservable.pipe(catchError((err) => of({ err })));
        }), skipWhile((resp) => { var _a; return ((_a = resp === null || resp === void 0 ? void 0 : resp.err) === null || _a === void 0 ? void 0 : _a.status) === 404; }), // skip all requests that fail because missing Elastic index
        throwIfEmpty(() => 'Could not find an available index for this time range.'), // when i === Math.min(listLen, maxTraversals) generate will complete but without emitting any values which means we didn't find a valid index
        first(), // take the first value that isn't skipped
        map((resp) => {
            if (resp.err) {
                throw resp.err; // if there is some other error except 404 then we must throw it
            }
            return resp;
        }));
    }
    annotationQuery(options) {
        const payload = this.prepareAnnotationRequest(options);
        trackAnnotationQuery(options.annotation);
        const annotationObservable = config.featureToggles.enableElasticsearchBackendQuerying
            ? // TODO: We should migrate this to use query and not resource call
                // The plan is to look at this when we start to work on raw query editor for ES
                // as we will have to explore how to handle any query
                from(this.postResourceRequest('_msearch', payload))
            : this.legacyQueryRunner.request('POST', '_msearch', payload);
        return lastValueFrom(annotationObservable.pipe(map((res) => {
            const hits = res.responses[0].hits.hits;
            return this.processHitsToAnnotationEvents(options.annotation, hits);
        })));
    }
    prepareAnnotationRequest(options) {
        var _a, _b, _c;
        const annotation = options.annotation;
        const timeField = annotation.timeField || '@timestamp';
        const timeEndField = annotation.timeEndField || null;
        // the `target.query` is the "new" location for the query.
        // normally we would write this code as
        // try-the-new-place-then-try-the-old-place,
        // but we had the bug at
        // https://github.com/grafana/grafana/issues/61107
        // that may have stored annotations where
        // both the old and the new place are set,
        // and in that scenario the old place needs
        // to have priority.
        const queryString = (_c = (_a = annotation.query) !== null && _a !== void 0 ? _a : (_b = annotation.target) === null || _b === void 0 ? void 0 : _b.query) !== null && _c !== void 0 ? _c : '';
        const dateRanges = [];
        const rangeStart = {};
        rangeStart[timeField] = {
            from: options.range.from.valueOf(),
            to: options.range.to.valueOf(),
            format: 'epoch_millis',
        };
        dateRanges.push({ range: rangeStart });
        if (timeEndField) {
            const rangeEnd = {};
            rangeEnd[timeEndField] = {
                from: options.range.from.valueOf(),
                to: options.range.to.valueOf(),
                format: 'epoch_millis',
            };
            dateRanges.push({ range: rangeEnd });
        }
        const queryInterpolated = this.interpolateLuceneQuery(queryString);
        const query = {
            bool: {
                filter: [
                    {
                        bool: {
                            should: dateRanges,
                            minimum_should_match: 1,
                        },
                    },
                ],
            },
        };
        if (queryInterpolated) {
            query.bool.filter.push({
                query_string: {
                    query: queryInterpolated,
                },
            });
        }
        const data = {
            query,
            size: 10000,
        };
        const header = {
            search_type: 'query_then_fetch',
            ignore_unavailable: true,
        };
        // @deprecated
        // Field annotation.index is deprecated and will be removed in the future
        if (annotation.index) {
            header.index = annotation.index;
        }
        else {
            header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
        }
        const payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';
        return payload;
    }
    processHitsToAnnotationEvents(annotation, hits) {
        const timeField = annotation.timeField || '@timestamp';
        const timeEndField = annotation.timeEndField || null;
        const textField = annotation.textField || 'tags';
        const tagsField = annotation.tagsField || null;
        const list = [];
        const getFieldFromSource = (source, fieldName) => {
            if (!fieldName) {
                return;
            }
            const fieldNames = fieldName.split('.');
            let fieldValue = source;
            for (let i = 0; i < fieldNames.length; i++) {
                fieldValue = fieldValue[fieldNames[i]];
                if (!fieldValue) {
                    return '';
                }
            }
            return fieldValue;
        };
        for (let i = 0; i < hits.length; i++) {
            const source = hits[i]._source;
            let time = getFieldFromSource(source, timeField);
            if (typeof hits[i].fields !== 'undefined') {
                const fields = hits[i].fields;
                if (typeof fields === 'object' && (isString(fields[timeField]) || isNumber(fields[timeField]))) {
                    time = fields[timeField];
                }
            }
            const event = {
                annotation: annotation,
                time: toUtc(time).valueOf(),
                text: getFieldFromSource(source, textField),
            };
            if (timeEndField) {
                const timeEnd = getFieldFromSource(source, timeEndField);
                if (timeEnd) {
                    event.timeEnd = toUtc(timeEnd).valueOf();
                }
            }
            // legacy support for title field
            if (annotation.titleField) {
                const title = getFieldFromSource(source, annotation.titleField);
                if (title) {
                    event.text = title + '\n' + event.text;
                }
            }
            const tags = getFieldFromSource(source, tagsField);
            if (typeof tags === 'string') {
                event.tags = tags.split(',');
            }
            else {
                event.tags = tags;
            }
            list.push(event);
        }
        return list;
    }
    interpolateLuceneQuery(queryString, scopedVars) {
        return this.templateSrv.replace(queryString, scopedVars, 'lucene');
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        return queries.map((q) => this.applyTemplateVariables(q, scopedVars));
    }
    testDatasource() {
        return __awaiter(this, void 0, void 0, function* () {
            // we explicitly ask for uncached, "fresh" data here
            const dbVersion = yield this.getDatabaseVersion(false);
            // if we are not able to determine the elastic-version, we assume it is a good version.
            const isSupported = dbVersion != null ? isSupportedVersion(dbVersion) : true;
            const versionMessage = isSupported ? '' : `WARNING: ${unsupportedVersionMessage} `;
            // validate that the index exist and has date field
            return lastValueFrom(this.getFields(['date']).pipe(mergeMap((dateFields) => {
                const timeField = find(dateFields, { text: this.timeField });
                if (!timeField) {
                    return of({
                        status: 'error',
                        message: 'No date field named ' + this.timeField + ' found',
                    });
                }
                return of({ status: 'success', message: `${versionMessage}Data source successfully connected.` });
            }), catchError((err) => {
                const infoInParentheses = err.message ? ` (${err.message})` : '';
                const message = `Unable to connect with Elasticsearch${infoInParentheses}. Please check the server logs for more details.`;
                return of({ status: 'error', message });
            })));
        });
    }
    getQueryHeader(searchType, timeFrom, timeTo) {
        const queryHeader = {
            search_type: searchType,
            ignore_unavailable: true,
            index: this.indexPattern.getIndexList(timeFrom, timeTo),
        };
        return JSON.stringify(queryHeader);
    }
    getQueryDisplayText(query) {
        // TODO: This might be refactored a bit.
        const metricAggs = query.metrics;
        const bucketAggs = query.bucketAggs;
        let text = '';
        if (query.query) {
            text += 'Query: ' + query.query + ', ';
        }
        text += 'Metrics: ';
        text += metricAggs === null || metricAggs === void 0 ? void 0 : metricAggs.reduce((acc, metric) => {
            const metricConfig = metricAggregationConfig[metric.type];
            let text = metricConfig.label + '(';
            if (isMetricAggregationWithField(metric)) {
                text += metric.field;
            }
            if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
                text += getScriptValue(metric).replace(new RegExp('params.', 'g'), '');
            }
            text += '), ';
            return `${acc} ${text}`;
        }, '');
        text += bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.reduce((acc, bucketAgg, index) => {
            const bucketConfig = bucketAggregationConfig[bucketAgg.type];
            let text = '';
            if (index === 0) {
                text += ' Group by: ';
            }
            text += bucketConfig.label + '(';
            if (isBucketAggregationWithField(bucketAgg)) {
                text += bucketAgg.field;
            }
            return `${acc} ${text}), `;
        }, '');
        if (query.alias) {
            text += 'Alias: ' + query.alias;
        }
        return text;
    }
    showContextToggle() {
        return true;
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
        var _a, _b;
        if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
            return undefined;
        }
        let isQuerySuitable = false;
        switch (options.type) {
            case SupplementaryQueryType.LogsVolume:
                // it has to be a logs-producing range-query
                isQuerySuitable = !!(((_a = query.metrics) === null || _a === void 0 ? void 0 : _a.length) === 1 && query.metrics[0].type === 'logs');
                if (!isQuerySuitable) {
                    return undefined;
                }
                const bucketAggs = [];
                const timeField = (_b = this.timeField) !== null && _b !== void 0 ? _b : '@timestamp';
                if (this.logLevelField) {
                    bucketAggs.push({
                        id: '2',
                        type: 'terms',
                        settings: {
                            min_doc_count: '0',
                            size: '0',
                            order: 'desc',
                            orderBy: '_count',
                            missing: LogLevel.unknown,
                        },
                        field: this.logLevelField,
                    });
                }
                bucketAggs.push({
                    id: '3',
                    type: 'date_histogram',
                    settings: {
                        interval: 'auto',
                        min_doc_count: '0',
                        trimEdges: '0',
                    },
                    field: timeField,
                });
                return {
                    refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
                    query: query.query,
                    metrics: [{ type: 'count', id: '1' }],
                    timeField,
                    bucketAggs,
                };
            case SupplementaryQueryType.LogsSample:
                isQuerySuitable = isTimeSeriesQuery(query);
                if (!isQuerySuitable) {
                    return undefined;
                }
                if (options.limit) {
                    return {
                        refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
                        query: query.query,
                        metrics: [{ type: 'logs', id: '1', settings: { limit: options.limit.toString() } }],
                    };
                }
                return {
                    refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
                    query: query.query,
                    metrics: [{ type: 'logs', id: '1' }],
                };
            default:
                return undefined;
        }
    }
    getLogsVolumeDataProvider(request) {
        const logsVolumeRequest = cloneDeep(request);
        const targets = logsVolumeRequest.targets
            .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, target))
            .filter((query) => !!query);
        if (!targets.length) {
            return undefined;
        }
        return queryLogsVolume(this, Object.assign(Object.assign({}, logsVolumeRequest), { targets }), {
            range: request.range,
            targets: request.targets,
            extractLevel,
        });
    }
    getLogsSampleDataProvider(request) {
        const logsSampleRequest = cloneDeep(request);
        const targets = logsSampleRequest.targets;
        const queries = targets.map((query) => {
            return this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, query);
        });
        const elasticQueries = queries.filter((query) => !!query);
        if (!elasticQueries.length) {
            return undefined;
        }
        return queryLogsSample(this, Object.assign(Object.assign({}, logsSampleRequest), { targets: elasticQueries }));
    }
    query(request) {
        const { enableElasticsearchBackendQuerying } = config.featureToggles;
        if (enableElasticsearchBackendQuerying) {
            const start = new Date();
            return super.query(request).pipe(tap((response) => trackQuery(response, request, start)), map((response) => {
                response.data.forEach((dataFrame) => {
                    enhanceDataFrameWithDataLinks(dataFrame, this.dataLinks);
                });
                return response;
            }));
        }
        return this.legacyQueryRunner.query(request);
    }
    filterQuery(query) {
        if (query.hide) {
            return false;
        }
        return true;
    }
    isMetadataField(fieldName) {
        return ELASTIC_META_FIELDS.includes(fieldName);
    }
    // TODO: instead of being a string, this could be a custom type representing all the elastic types
    // FIXME: This doesn't seem to return actual MetricFindValues, we should either change the return type
    // or fix the implementation.
    getFields(type, range) {
        const typeMap = {
            float: 'number',
            double: 'number',
            integer: 'number',
            long: 'number',
            date: 'date',
            date_nanos: 'date',
            string: 'string',
            text: 'string',
            scaled_float: 'number',
            nested: 'nested',
            histogram: 'number',
        };
        return this.requestAllIndices('/_mapping', range).pipe(map((result) => {
            const shouldAddField = (obj, key) => {
                if (this.isMetadataField(key)) {
                    return false;
                }
                if (!type || type.length === 0) {
                    return true;
                }
                // equal query type filter, or via type map translation
                return type.includes(obj.type) || type.includes(typeMap[obj.type]);
            };
            // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
            const fieldNameParts = [];
            const fields = {};
            function getFieldsRecursively(obj) {
                for (const key in obj) {
                    const subObj = obj[key];
                    // Check mapping field for nested fields
                    if (isObject(subObj.properties)) {
                        fieldNameParts.push(key);
                        getFieldsRecursively(subObj.properties);
                    }
                    if (isObject(subObj.fields)) {
                        fieldNameParts.push(key);
                        getFieldsRecursively(subObj.fields);
                    }
                    if (isString(subObj.type)) {
                        const fieldName = fieldNameParts.concat(key).join('.');
                        // Hide meta-fields and check field type
                        if (shouldAddField(subObj, key)) {
                            fields[fieldName] = {
                                text: fieldName,
                                type: subObj.type,
                            };
                        }
                    }
                }
                fieldNameParts.pop();
            }
            for (const indexName in result) {
                const index = result[indexName];
                if (index && index.mappings) {
                    const mappings = index.mappings;
                    const properties = mappings.properties;
                    getFieldsRecursively(properties);
                }
            }
            // transform to array
            return _map(fields, (value) => {
                return value;
            });
        }));
    }
    getTerms(queryDef, range = getDefaultTimeRange()) {
        const searchType = 'query_then_fetch';
        const header = this.getQueryHeader(searchType, range.from, range.to);
        let esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));
        esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
        esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
        esQuery = header + '\n' + esQuery + '\n';
        const url = this.getMultiSearchUrl();
        const termsObservable = config.featureToggles.enableElasticsearchBackendQuerying
            ? // TODO: This is run through resource call, but maybe should run through query
                from(this.postResourceRequest(url, esQuery))
            : this.legacyQueryRunner.request('POST', url, esQuery);
        return termsObservable.pipe(map((res) => {
            if (!res.responses[0].aggregations) {
                return [];
            }
            const buckets = res.responses[0].aggregations['1'].buckets;
            return _map(buckets, (bucket) => {
                return {
                    text: bucket.key_as_string || bucket.key,
                    value: bucket.key,
                };
            });
        }));
    }
    getMultiSearchUrl() {
        const searchParams = new URLSearchParams();
        if (this.maxConcurrentShardRequests) {
            searchParams.append('max_concurrent_shard_requests', `${this.maxConcurrentShardRequests}`);
        }
        if (this.xpack && this.includeFrozen) {
            searchParams.append('ignore_throttled', 'false');
        }
        return ('_msearch?' + searchParams.toString()).replace(/\?$/, '');
    }
    metricFindQuery(query, options) {
        const range = options === null || options === void 0 ? void 0 : options.range;
        const parsedQuery = JSON.parse(query);
        if (query) {
            if (parsedQuery.find === 'fields') {
                parsedQuery.type = this.interpolateLuceneQuery(parsedQuery.type);
                return lastValueFrom(this.getFields(parsedQuery.type, range));
            }
            if (parsedQuery.find === 'terms') {
                parsedQuery.field = this.interpolateLuceneQuery(parsedQuery.field);
                parsedQuery.query = this.interpolateLuceneQuery(parsedQuery.query);
                return lastValueFrom(this.getTerms(parsedQuery, range));
            }
        }
        return Promise.resolve([]);
    }
    getTagKeys() {
        return lastValueFrom(this.getFields());
    }
    getTagValues(options) {
        const range = this.timeSrv.timeRange();
        return lastValueFrom(this.getTerms({ field: options.key }, range));
    }
    targetContainsTemplate(target) {
        if (this.templateSrv.containsTemplate(target.query) || this.templateSrv.containsTemplate(target.alias)) {
            return true;
        }
        if (target.bucketAggs) {
            for (const bucketAgg of target.bucketAggs) {
                if (isBucketAggregationWithField(bucketAgg) && this.templateSrv.containsTemplate(bucketAgg.field)) {
                    return true;
                }
                if (this.objectContainsTemplate(bucketAgg.settings)) {
                    return true;
                }
            }
        }
        if (target.metrics) {
            for (const metric of target.metrics) {
                if (!isMetricAggregationWithField(metric)) {
                    continue;
                }
                if (metric.field && this.templateSrv.containsTemplate(metric.field)) {
                    return true;
                }
                if (metric.settings && this.objectContainsTemplate(metric.settings)) {
                    return true;
                }
                if (isMetricAggregationWithMeta(metric) && this.objectContainsTemplate(metric.meta)) {
                    return true;
                }
            }
        }
        return false;
    }
    objectContainsTemplate(obj) {
        if (typeof obj === 'string') {
            return this.templateSrv.containsTemplate(obj);
        }
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        for (const key of Object.keys(obj)) {
            if (Array.isArray(obj[key])) {
                for (const item of obj[key]) {
                    if (this.objectContainsTemplate(item)) {
                        return true;
                    }
                }
            }
            else if (this.objectContainsTemplate(obj[key])) {
                return true;
            }
        }
        return false;
    }
    toggleQueryFilter(query, filter) {
        var _a;
        let expression = (_a = query.query) !== null && _a !== void 0 ? _a : '';
        switch (filter.type) {
            case 'FILTER_FOR': {
                // This gives the user the ability to toggle a filter on and off.
                expression = queryHasFilter(expression, filter.options.key, filter.options.value)
                    ? removeFilterFromQuery(expression, filter.options.key, filter.options.value)
                    : addFilterToQuery(expression, filter.options.key, filter.options.value);
                break;
            }
            case 'FILTER_OUT': {
                // If the opposite filter is present, remove it before adding the new one.
                if (queryHasFilter(expression, filter.options.key, filter.options.value)) {
                    expression = removeFilterFromQuery(expression, filter.options.key, filter.options.value);
                }
                expression = addFilterToQuery(expression, filter.options.key, filter.options.value, '-');
                break;
            }
        }
        return Object.assign(Object.assign({}, query), { query: expression });
    }
    queryHasFilter(query, options) {
        var _a;
        let expression = (_a = query.query) !== null && _a !== void 0 ? _a : '';
        return queryHasFilter(expression, options.key, options.value);
    }
    modifyQuery(query, action) {
        var _a;
        if (!action.options) {
            return query;
        }
        let expression = (_a = query.query) !== null && _a !== void 0 ? _a : '';
        switch (action.type) {
            case 'ADD_FILTER': {
                expression = addFilterToQuery(expression, action.options.key, action.options.value);
                break;
            }
            case 'ADD_FILTER_OUT': {
                expression = addFilterToQuery(expression, action.options.key, action.options.value, '-');
                break;
            }
        }
        return Object.assign(Object.assign({}, query), { query: expression });
    }
    addAdHocFilters(query) {
        const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        if (adhocFilters.length === 0) {
            return query;
        }
        const esFilters = adhocFilters.map((filter) => {
            let { key, operator, value } = filter;
            if (!key || !value) {
                return;
            }
            /**
             * Keys and values in ad hoc filters may contain characters such as
             * colons, which needs to be escaped.
             */
            key = escapeFilter(key);
            value = escapeFilterValue(value);
            switch (operator) {
                case '=':
                    return `${key}:"${value}"`;
                case '!=':
                    return `-${key}:"${value}"`;
                case '=~':
                    return `${key}:/${value}/`;
                case '!~':
                    return `-${key}:/${value}/`;
                case '>':
                    return `${key}:>${value}`;
                case '<':
                    return `${key}:<${value}`;
            }
            return;
        });
        const finalQuery = [query, ...esFilters].filter((f) => f).join(' AND ');
        return finalQuery;
    }
    // Used when running queries through backend
    applyTemplateVariables(query, scopedVars) {
        var _a;
        // We need a separate interpolation format for lucene queries, therefore we first interpolate any
        // lucene query string and then everything else
        const interpolateBucketAgg = (bucketAgg) => {
            var _a, _b;
            if (bucketAgg.type === 'filters') {
                return Object.assign(Object.assign({}, bucketAgg), { settings: Object.assign(Object.assign({}, bucketAgg.settings), { filters: (_b = (_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.map((filter) => (Object.assign(Object.assign({}, filter), { query: this.interpolateLuceneQuery(filter.query, scopedVars) || '*' }))) }) });
            }
            return bucketAgg;
        };
        const expandedQuery = Object.assign(Object.assign({}, query), { datasource: this.getRef(), query: this.addAdHocFilters(this.interpolateLuceneQuery(query.query || '', scopedVars)), bucketAggs: (_a = query.bucketAggs) === null || _a === void 0 ? void 0 : _a.map(interpolateBucketAgg) });
        const finalQuery = JSON.parse(this.templateSrv.replace(JSON.stringify(expandedQuery), scopedVars));
        return finalQuery;
    }
    getDatabaseVersionUncached() {
        // we want this function to never fail
        const getDbVersionObservable = config.featureToggles.enableElasticsearchBackendQuerying
            ? from(this.getResourceRequest(''))
            : this.legacyQueryRunner.request('GET', '/');
        return lastValueFrom(getDbVersionObservable).then((data) => {
            var _a;
            const versionNumber = (_a = data === null || data === void 0 ? void 0 : data.version) === null || _a === void 0 ? void 0 : _a.number;
            if (typeof versionNumber !== 'string') {
                return null;
            }
            try {
                return new SemVer(versionNumber);
            }
            catch (error) {
                console.error(error);
                return null;
            }
        }, (error) => {
            console.error(error);
            return null;
        });
    }
    getDatabaseVersion(useCachedData = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (useCachedData) {
                const cached = this.databaseVersion;
                if (cached != null) {
                    return cached;
                }
            }
            const freshDatabaseVersion = yield this.getDatabaseVersionUncached();
            this.databaseVersion = freshDatabaseVersion;
            return freshDatabaseVersion;
        });
    }
}
export function enhanceDataFrameWithDataLinks(dataFrame, dataLinks) {
    if (!dataLinks.length) {
        return;
    }
    for (const field of dataFrame.fields) {
        const linksToApply = dataLinks.filter((dataLink) => new RegExp(dataLink.field).test(field.name));
        if (linksToApply.length === 0) {
            continue;
        }
        field.config = field.config || {};
        field.config.links = [...(field.config.links || [], linksToApply.map(generateDataLink))];
    }
}
function generateDataLink(linkConfig) {
    var _a;
    const dataSourceSrv = getDataSourceSrv();
    if (linkConfig.datasourceUid) {
        const dsSettings = dataSourceSrv.getInstanceSettings(linkConfig.datasourceUid);
        return {
            title: linkConfig.urlDisplayLabel || '',
            url: '',
            internal: {
                query: { query: linkConfig.url },
                datasourceUid: linkConfig.datasourceUid,
                datasourceName: (_a = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _a !== void 0 ? _a : 'Data source not found',
            },
        };
    }
    else {
        return {
            title: linkConfig.urlDisplayLabel || '',
            url: linkConfig.url,
        };
    }
}
function createContextTimeRange(rowTimeEpochMs, direction, intervalPattern) {
    const offset = 7;
    // For log context, we want to request data from 7 subsequent/previous indices
    if (intervalPattern) {
        const intervalInfo = intervalMap[intervalPattern];
        if (direction === LogRowContextQueryDirection.Forward) {
            return {
                from: dateTime(rowTimeEpochMs).utc(),
                to: dateTime(rowTimeEpochMs).add(offset, intervalInfo.amount).utc().startOf(intervalInfo.startOf),
            };
        }
        else {
            return {
                from: dateTime(rowTimeEpochMs).subtract(offset, intervalInfo.amount).utc().startOf(intervalInfo.startOf),
                to: dateTime(rowTimeEpochMs).utc(),
            };
        }
        // If we don't have an interval pattern, we can't do this, so we just request data from 7h before/after
    }
    else {
        if (direction === LogRowContextQueryDirection.Forward) {
            return {
                from: dateTime(rowTimeEpochMs).utc(),
                to: dateTime(rowTimeEpochMs).add(offset, 'hours').utc(),
            };
        }
        else {
            return {
                from: dateTime(rowTimeEpochMs).subtract(offset, 'hours').utc(),
                to: dateTime(rowTimeEpochMs).utc(),
            };
        }
    }
}
function extractLevel(dataFrame) {
    var _a, _b;
    const valueField = dataFrame.fields.find((f) => f.type === FieldType.number);
    const name = (_b = (_a = valueField === null || valueField === void 0 ? void 0 : valueField.labels) === null || _a === void 0 ? void 0 : _a['level']) !== null && _b !== void 0 ? _b : '';
    return getLogLevelFromKey(name);
}
//# sourceMappingURL=datasource.js.map