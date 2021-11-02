import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { cloneDeep, find, first as _first, isNumber, isObject, isString, map as _map } from 'lodash';
import { generate, lastValueFrom, of, throwError } from 'rxjs';
import { catchError, first, map, mergeMap, skipWhile, throwIfEmpty } from 'rxjs/operators';
import { gte, lt, satisfies } from 'semver';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { DataSourceApi, dateTime, getDefaultTimeRange, toUtc, } from '@grafana/data';
import LanguageProvider from './language_provider';
import { ElasticResponse } from './elastic_response';
import { IndexPattern } from './index_pattern';
import { ElasticQueryBuilder } from './query_builder';
import { defaultBucketAgg, hasMetricOfType } from './query_def';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { isMetricAggregationWithField, isPipelineAggregationWithMultipleBucketPaths, } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import { isBucketAggregationWithField, } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { coerceESVersion, getScriptValue } from './utils';
// Those are metadata fields as defined in https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields.
// custom fields can start with underscores, therefore is not safe to exclude anything that starts with one.
var ELASTIC_META_FIELDS = [
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
var ElasticDatasource = /** @class */ (function (_super) {
    __extends(ElasticDatasource, _super);
    function ElasticDatasource(instanceSettings, templateSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _a, _b;
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.getLogRowContext = function (row, options) { return __awaiter(_this, void 0, void 0, function () {
            var sortField, searchAfter, sort, header, limit, esQuery, payload, url, response, targets, elasticResponse, logResponse, dataFrame, timestampField, lineField;
            var _a, _b, _c;
            var _this = this;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        sortField = row.dataFrame.fields.find(function (f) { return f.name === 'sort'; });
                        searchAfter = (sortField === null || sortField === void 0 ? void 0 : sortField.values.get(row.rowIndex)) || [row.timeEpochMs];
                        sort = (options === null || options === void 0 ? void 0 : options.direction) === 'FORWARD' ? 'asc' : 'desc';
                        header = (options === null || options === void 0 ? void 0 : options.direction) === 'FORWARD'
                            ? this.getQueryHeader('query_then_fetch', dateTime(row.timeEpochMs))
                            : this.getQueryHeader('query_then_fetch', undefined, dateTime(row.timeEpochMs));
                        limit = (_d = options === null || options === void 0 ? void 0 : options.limit) !== null && _d !== void 0 ? _d : 10;
                        esQuery = JSON.stringify({
                            size: limit,
                            query: {
                                bool: {
                                    filter: [
                                        {
                                            range: (_a = {},
                                                _a[this.timeField] = (_b = {},
                                                    _b[(options === null || options === void 0 ? void 0 : options.direction) === 'FORWARD' ? 'gte' : 'lte'] = row.timeEpochMs,
                                                    _b.format = 'epoch_millis',
                                                    _b),
                                                _a),
                                        },
                                    ],
                                },
                            },
                            sort: [(_c = {}, _c[this.timeField] = sort, _c), { _doc: sort }],
                            search_after: searchAfter,
                        });
                        payload = [header, esQuery].join('\n') + '\n';
                        url = this.getMultiSearchUrl();
                        return [4 /*yield*/, lastValueFrom(this.post(url, payload))];
                    case 1:
                        response = _e.sent();
                        targets = [{ refId: "" + row.dataFrame.refId, metrics: [{ type: 'logs', id: '1' }] }];
                        elasticResponse = new ElasticResponse(targets, transformHitsBasedOnDirection(response, sort));
                        logResponse = elasticResponse.getLogs(this.logMessageField, this.logLevelField);
                        dataFrame = _first(logResponse.data);
                        if (!dataFrame) {
                            return [2 /*return*/, { data: [] }];
                        }
                        timestampField = dataFrame.fields.find(function (f) { return f.name === _this.timeField; });
                        lineField = dataFrame.fields.find(function (f) { return f.name === _this.logMessageField; });
                        if (timestampField && lineField) {
                            return [2 /*return*/, {
                                    data: [
                                        __assign(__assign({}, dataFrame), { fields: __spreadArray(__spreadArray([], __read(dataFrame.fields), false), [__assign(__assign({}, timestampField), { name: 'ts' }), __assign(__assign({}, lineField), { name: 'line' })], false) }),
                                    ],
                                }];
                        }
                        return [2 /*return*/, logResponse];
                }
            });
        }); };
        _this.basicAuth = instanceSettings.basicAuth;
        _this.withCredentials = instanceSettings.withCredentials;
        _this.url = instanceSettings.url;
        _this.name = instanceSettings.name;
        _this.index = (_a = instanceSettings.database) !== null && _a !== void 0 ? _a : '';
        var settingsData = instanceSettings.jsonData || {};
        _this.timeField = settingsData.timeField;
        _this.esVersion = coerceESVersion(settingsData.esVersion);
        _this.xpack = Boolean(settingsData.xpack);
        _this.indexPattern = new IndexPattern(_this.index, settingsData.interval);
        _this.interval = settingsData.timeInterval;
        _this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
        _this.queryBuilder = new ElasticQueryBuilder({
            timeField: _this.timeField,
            esVersion: _this.esVersion,
        });
        _this.logMessageField = settingsData.logMessageField || '';
        _this.logLevelField = settingsData.logLevelField || '';
        _this.dataLinks = settingsData.dataLinks || [];
        _this.includeFrozen = (_b = settingsData.includeFrozen) !== null && _b !== void 0 ? _b : false;
        if (_this.logMessageField === '') {
            _this.logMessageField = undefined;
        }
        if (_this.logLevelField === '') {
            _this.logLevelField = undefined;
        }
        _this.languageProvider = new LanguageProvider(_this);
        return _this;
    }
    ElasticDatasource.prototype.request = function (method, url, data, headers) {
        var options = {
            url: this.url + '/' + url,
            method: method,
            data: data,
            headers: headers,
        };
        if (this.basicAuth || this.withCredentials) {
            options.withCredentials = true;
        }
        if (this.basicAuth) {
            options.headers = {
                Authorization: this.basicAuth,
            };
        }
        return getBackendSrv()
            .fetch(options)
            .pipe(map(function (results) {
            results.data.$$config = results.config;
            return results.data;
        }), catchError(function (err) {
            var _a, _b, _c;
            if (err.data) {
                var message = (_c = (_b = (_a = err.data.error) === null || _a === void 0 ? void 0 : _a.reason) !== null && _b !== void 0 ? _b : err.data.message) !== null && _c !== void 0 ? _c : 'Unknown error';
                return throwError({
                    message: 'Elasticsearch error: ' + message,
                    error: err.data.error,
                });
            }
            return throwError(err);
        }));
    };
    ElasticDatasource.prototype.importQueries = function (queries, originDataSource) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.languageProvider.importQueries(queries, originDataSource.meta.id)];
            });
        });
    };
    /**
     * Sends a GET request to the specified url on the newest matching and available index.
     *
     * When multiple indices span the provided time range, the request is sent starting from the newest index,
     * and then going backwards until an index is found.
     *
     * @param url the url to query the index on, for example `/_mapping`.
     */
    ElasticDatasource.prototype.get = function (url, range) {
        if (range === void 0) { range = getDefaultTimeRange(); }
        var indexList = this.indexPattern.getIndexList(range.from, range.to);
        if (!Array.isArray(indexList)) {
            indexList = [this.indexPattern.getIndexForToday()];
        }
        var indexUrlList = indexList.map(function (index) { return index + url; });
        return this.requestAllIndices(indexUrlList);
    };
    ElasticDatasource.prototype.requestAllIndices = function (indexList) {
        var _this = this;
        var maxTraversals = 7; // do not go beyond one week (for a daily pattern)
        var listLen = indexList.length;
        return generate({
            initialState: 0,
            condition: function (i) { return i < Math.min(listLen, maxTraversals); },
            iterate: function (i) { return i + 1; },
        }).pipe(mergeMap(function (index) {
            // catch all errors and emit an object with an err property to simplify checks later in the pipeline
            return _this.request('GET', indexList[listLen - index - 1]).pipe(catchError(function (err) { return of({ err: err }); }));
        }), skipWhile(function (resp) { var _a; return ((_a = resp === null || resp === void 0 ? void 0 : resp.err) === null || _a === void 0 ? void 0 : _a.status) === 404; }), // skip all requests that fail because missing Elastic index
        throwIfEmpty(function () { return 'Could not find an available index for this time range.'; }), // when i === Math.min(listLen, maxTraversals) generate will complete but without emitting any values which means we didn't find a valid index
        first(), // take the first value that isn't skipped
        map(function (resp) {
            if (resp.err) {
                throw resp.err; // if there is some other error except 404 then we must throw it
            }
            return resp;
        }));
    };
    ElasticDatasource.prototype.post = function (url, data) {
        return this.request('POST', url, data, { 'Content-Type': 'application/x-ndjson' });
    };
    ElasticDatasource.prototype.annotationQuery = function (options) {
        var annotation = options.annotation;
        var timeField = annotation.timeField || '@timestamp';
        var timeEndField = annotation.timeEndField || null;
        var queryString = annotation.query || '*';
        var tagsField = annotation.tagsField || 'tags';
        var textField = annotation.textField || null;
        var dateRanges = [];
        var rangeStart = {};
        rangeStart[timeField] = {
            from: options.range.from.valueOf(),
            to: options.range.to.valueOf(),
            format: 'epoch_millis',
        };
        dateRanges.push({ range: rangeStart });
        if (timeEndField) {
            var rangeEnd = {};
            rangeEnd[timeEndField] = {
                from: options.range.from.valueOf(),
                to: options.range.to.valueOf(),
                format: 'epoch_millis',
            };
            dateRanges.push({ range: rangeEnd });
        }
        var queryInterpolated = this.templateSrv.replace(queryString, {}, 'lucene');
        var query = {
            bool: {
                filter: [
                    {
                        bool: {
                            should: dateRanges,
                            minimum_should_match: 1,
                        },
                    },
                    {
                        query_string: {
                            query: queryInterpolated,
                        },
                    },
                ],
            },
        };
        var data = {
            query: query,
            size: 10000,
        };
        // fields field not supported on ES 5.x
        if (lt(this.esVersion, '5.0.0')) {
            data['fields'] = [timeField, '_source'];
        }
        var header = {
            search_type: 'query_then_fetch',
            ignore_unavailable: true,
        };
        // old elastic annotations had index specified on them
        if (annotation.index) {
            header.index = annotation.index;
        }
        else {
            header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
        }
        var payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';
        return lastValueFrom(this.post('_msearch', payload).pipe(map(function (res) {
            var list = [];
            var hits = res.responses[0].hits.hits;
            var getFieldFromSource = function (source, fieldName) {
                if (!fieldName) {
                    return;
                }
                var fieldNames = fieldName.split('.');
                var fieldValue = source;
                for (var i = 0; i < fieldNames.length; i++) {
                    fieldValue = fieldValue[fieldNames[i]];
                    if (!fieldValue) {
                        console.log('could not find field in annotation: ', fieldName);
                        return '';
                    }
                }
                return fieldValue;
            };
            for (var i = 0; i < hits.length; i++) {
                var source = hits[i]._source;
                var time = getFieldFromSource(source, timeField);
                if (typeof hits[i].fields !== 'undefined') {
                    var fields = hits[i].fields;
                    if (isString(fields[timeField]) || isNumber(fields[timeField])) {
                        time = fields[timeField];
                    }
                }
                var event_1 = {
                    annotation: annotation,
                    time: toUtc(time).valueOf(),
                    text: getFieldFromSource(source, textField),
                    tags: getFieldFromSource(source, tagsField),
                };
                if (timeEndField) {
                    var timeEnd = getFieldFromSource(source, timeEndField);
                    if (timeEnd) {
                        event_1.timeEnd = toUtc(timeEnd).valueOf();
                    }
                }
                // legacy support for title tield
                if (annotation.titleField) {
                    var title = getFieldFromSource(source, annotation.titleField);
                    if (title) {
                        event_1.text = title + '\n' + event_1.text;
                    }
                }
                if (typeof event_1.tags === 'string') {
                    event_1.tags = event_1.tags.split(',');
                }
                list.push(event_1);
            }
            return list;
        })));
    };
    ElasticDatasource.prototype.interpolateLuceneQuery = function (queryString, scopedVars) {
        // Elasticsearch queryString should always be '*' if empty string
        return this.templateSrv.replace(queryString, scopedVars, 'lucene') || '*';
    };
    ElasticDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        // We need a separate interpolation format for lucene queries, therefore we first interpolate any
        // lucene query string and then everything else
        var interpolateBucketAgg = function (bucketAgg) {
            var _a, _b;
            if (bucketAgg.type === 'filters') {
                return __assign(__assign({}, bucketAgg), { settings: __assign(__assign({}, bucketAgg.settings), { filters: (_b = (_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.map(function (filter) { return (__assign(__assign({}, filter), { query: _this.interpolateLuceneQuery(filter.query || '', scopedVars) })); }) }) });
            }
            return bucketAgg;
        };
        var expandedQueries = queries.map(function (query) {
            var _a;
            return (__assign(__assign({}, query), { datasource: _this.getRef(), query: _this.interpolateLuceneQuery(query.query || '', scopedVars), bucketAggs: (_a = query.bucketAggs) === null || _a === void 0 ? void 0 : _a.map(interpolateBucketAgg) }));
        });
        var finalQueries = JSON.parse(this.templateSrv.replace(JSON.stringify(expandedQueries), scopedVars));
        return finalQueries;
    };
    ElasticDatasource.prototype.testDatasource = function () {
        var _this = this;
        // validate that the index exist and has date field
        return lastValueFrom(this.getFields(['date']).pipe(mergeMap(function (dateFields) {
            var timeField = find(dateFields, { text: _this.timeField });
            if (!timeField) {
                return of({ status: 'error', message: 'No date field named ' + _this.timeField + ' found' });
            }
            return of({ status: 'success', message: 'Index OK. Time field name OK.' });
        }), catchError(function (err) {
            console.error(err);
            if (err.message) {
                return of({ status: 'error', message: err.message });
            }
            else {
                return of({ status: 'error', message: err.status });
            }
        })));
    };
    ElasticDatasource.prototype.getQueryHeader = function (searchType, timeFrom, timeTo) {
        var queryHeader = {
            search_type: searchType,
            ignore_unavailable: true,
            index: this.indexPattern.getIndexList(timeFrom, timeTo),
        };
        if (satisfies(this.esVersion, '>=5.6.0 <7.0.0')) {
            queryHeader['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
        }
        return JSON.stringify(queryHeader);
    };
    ElasticDatasource.prototype.getQueryDisplayText = function (query) {
        // TODO: This might be refactored a bit.
        var metricAggs = query.metrics;
        var bucketAggs = query.bucketAggs;
        var text = '';
        if (query.query) {
            text += 'Query: ' + query.query + ', ';
        }
        text += 'Metrics: ';
        text += metricAggs === null || metricAggs === void 0 ? void 0 : metricAggs.reduce(function (acc, metric) {
            var metricConfig = metricAggregationConfig[metric.type];
            var text = metricConfig.label + '(';
            if (isMetricAggregationWithField(metric)) {
                text += metric.field;
            }
            if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
                text += getScriptValue(metric).replace(new RegExp('params.', 'g'), '');
            }
            text += '), ';
            return acc + " " + text;
        }, '');
        text += bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.reduce(function (acc, bucketAgg, index) {
            var bucketConfig = bucketAggregationConfig[bucketAgg.type];
            var text = '';
            if (index === 0) {
                text += ' Group by: ';
            }
            text += bucketConfig.label + '(';
            if (isBucketAggregationWithField(bucketAgg)) {
                text += bucketAgg.field;
            }
            return acc + " " + text + "), ";
        }, '');
        if (query.alias) {
            text += 'Alias: ' + query.alias;
        }
        return text;
    };
    /**
     * This method checks to ensure the user is running a 5.0+ cluster. This is
     * necessary bacause the query being used for the getLogRowContext relies on the
     * search_after feature.
     */
    ElasticDatasource.prototype.showContextToggle = function () {
        return gte(this.esVersion, '5.0.0');
    };
    ElasticDatasource.prototype.query = function (options) {
        var e_1, _a;
        var _this = this;
        var _b, _c, _d;
        var payload = '';
        var targets = this.interpolateVariablesInQueries(cloneDeep(options.targets), options.scopedVars);
        var sentTargets = [];
        var targetsContainsLogsQuery = targets.some(function (target) { return hasMetricOfType(target, 'logs'); });
        // add global adhoc filters to timeFilter
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        var logLimits = [];
        try {
            for (var targets_1 = __values(targets), targets_1_1 = targets_1.next(); !targets_1_1.done; targets_1_1 = targets_1.next()) {
                var target = targets_1_1.value;
                if (target.hide) {
                    continue;
                }
                var queryObj = void 0;
                if (hasMetricOfType(target, 'logs')) {
                    // FIXME: All this logic here should be in the query builder.
                    // When moving to the BE-only implementation we should remove this and let the BE
                    // Handle this.
                    // TODO: defaultBucketAgg creates a dete_histogram aggregation without a field, so it fallbacks to
                    // the configured timeField. we should allow people to use a different time field here.
                    target.bucketAggs = [defaultBucketAgg()];
                    var log = (_b = target.metrics) === null || _b === void 0 ? void 0 : _b.find(function (m) { return m.type === 'logs'; });
                    var limit = ((_c = log.settings) === null || _c === void 0 ? void 0 : _c.limit) ? parseInt((_d = log.settings) === null || _d === void 0 ? void 0 : _d.limit, 10) : 500;
                    logLimits.push(limit);
                    target.metrics = [];
                    // Setting this for metrics queries that are typed as logs
                    queryObj = this.queryBuilder.getLogsQuery(target, limit, adhocFilters, target.query);
                }
                else {
                    logLimits.push();
                    if (target.alias) {
                        target.alias = this.templateSrv.replace(target.alias, options.scopedVars, 'lucene');
                    }
                    queryObj = this.queryBuilder.build(target, adhocFilters, target.query);
                }
                var esQuery = JSON.stringify(queryObj);
                var searchType = queryObj.size === 0 && lt(this.esVersion, '5.0.0') ? 'count' : 'query_then_fetch';
                var header = this.getQueryHeader(searchType, options.range.from, options.range.to);
                payload += header + '\n';
                payload += esQuery + '\n';
                sentTargets.push(target);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (targets_1_1 && !targets_1_1.done && (_a = targets_1.return)) _a.call(targets_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (sentTargets.length === 0) {
            return of({ data: [] });
        }
        // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
        // it as an integer not as string with digits. This is because elastic will convert the string only if the time
        // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
        // and then sending string will error out.
        payload = payload.replace(/"\$timeFrom"/g, options.range.from.valueOf().toString());
        payload = payload.replace(/"\$timeTo"/g, options.range.to.valueOf().toString());
        payload = this.templateSrv.replace(payload, options.scopedVars);
        var url = this.getMultiSearchUrl();
        return this.post(url, payload).pipe(map(function (res) {
            var er = new ElasticResponse(sentTargets, res);
            // TODO: This needs to be revisited, it seems wrong to process ALL the sent queries as logs if only one of them was a log query
            if (targetsContainsLogsQuery) {
                var response = er.getLogs(_this.logMessageField, _this.logLevelField);
                response.data.forEach(function (dataFrame, index) {
                    enhanceDataFrame(dataFrame, _this.dataLinks, logLimits[index]);
                });
                return response;
            }
            return er.getTimeSeries();
        }));
    };
    ElasticDatasource.prototype.isMetadataField = function (fieldName) {
        return ELASTIC_META_FIELDS.includes(fieldName);
    };
    // TODO: instead of being a string, this could be a custom type representing all the elastic types
    // FIXME: This doesn't seem to return actual MetricFindValues, we should either change the return type
    // or fix the implementation.
    ElasticDatasource.prototype.getFields = function (type, range) {
        var _this = this;
        var typeMap = {
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
        return this.get('/_mapping', range).pipe(map(function (result) {
            var shouldAddField = function (obj, key) {
                if (_this.isMetadataField(key)) {
                    return false;
                }
                if (!type || type.length === 0) {
                    return true;
                }
                // equal query type filter, or via typemap translation
                return type.includes(obj.type) || type.includes(typeMap[obj.type]);
            };
            // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
            var fieldNameParts = [];
            var fields = {};
            function getFieldsRecursively(obj) {
                for (var key in obj) {
                    var subObj = obj[key];
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
                        var fieldName = fieldNameParts.concat(key).join('.');
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
            for (var indexName in result) {
                var index = result[indexName];
                if (index && index.mappings) {
                    var mappings = index.mappings;
                    if (lt(_this.esVersion, '7.0.0')) {
                        for (var typeName in mappings) {
                            var properties = mappings[typeName].properties;
                            getFieldsRecursively(properties);
                        }
                    }
                    else {
                        var properties = mappings.properties;
                        getFieldsRecursively(properties);
                    }
                }
            }
            // transform to array
            return _map(fields, function (value) {
                return value;
            });
        }));
    };
    ElasticDatasource.prototype.getTerms = function (queryDef, range) {
        if (range === void 0) { range = getDefaultTimeRange(); }
        var searchType = gte(this.esVersion, '5.0.0') ? 'query_then_fetch' : 'count';
        var header = this.getQueryHeader(searchType, range.from, range.to);
        var esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));
        esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
        esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
        esQuery = header + '\n' + esQuery + '\n';
        var url = this.getMultiSearchUrl();
        return this.post(url, esQuery).pipe(map(function (res) {
            if (!res.responses[0].aggregations) {
                return [];
            }
            var buckets = res.responses[0].aggregations['1'].buckets;
            return _map(buckets, function (bucket) {
                return {
                    text: bucket.key_as_string || bucket.key,
                    value: bucket.key,
                };
            });
        }));
    };
    ElasticDatasource.prototype.getMultiSearchUrl = function () {
        var searchParams = new URLSearchParams();
        if (gte(this.esVersion, '7.0.0') && this.maxConcurrentShardRequests) {
            searchParams.append('max_concurrent_shard_requests', "" + this.maxConcurrentShardRequests);
        }
        if (gte(this.esVersion, '6.6.0') && this.xpack && this.includeFrozen) {
            searchParams.append('ignore_throttled', 'false');
        }
        return ('_msearch?' + searchParams.toString()).replace(/\?$/, '');
    };
    ElasticDatasource.prototype.metricFindQuery = function (query, options) {
        var range = options === null || options === void 0 ? void 0 : options.range;
        var parsedQuery = JSON.parse(query);
        if (query) {
            if (parsedQuery.find === 'fields') {
                parsedQuery.type = this.templateSrv.replace(parsedQuery.type, {}, 'lucene');
                return lastValueFrom(this.getFields(parsedQuery.type, range));
            }
            if (parsedQuery.find === 'terms') {
                parsedQuery.field = this.templateSrv.replace(parsedQuery.field, {}, 'lucene');
                parsedQuery.query = this.templateSrv.replace(parsedQuery.query || '*', {}, 'lucene');
                return lastValueFrom(this.getTerms(parsedQuery, range));
            }
        }
        return Promise.resolve([]);
    };
    ElasticDatasource.prototype.getTagKeys = function () {
        return lastValueFrom(this.getFields());
    };
    ElasticDatasource.prototype.getTagValues = function (options) {
        return lastValueFrom(this.getTerms({ field: options.key, query: '*' }));
    };
    ElasticDatasource.prototype.targetContainsTemplate = function (target) {
        var e_2, _a, e_3, _b;
        if (this.templateSrv.variableExists(target.query) || this.templateSrv.variableExists(target.alias)) {
            return true;
        }
        try {
            for (var _c = __values(target.bucketAggs), _d = _c.next(); !_d.done; _d = _c.next()) {
                var bucketAgg = _d.value;
                if (this.templateSrv.variableExists(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
                    return true;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            for (var _e = __values(target.metrics), _f = _e.next(); !_f.done; _f = _e.next()) {
                var metric = _f.value;
                if (this.templateSrv.variableExists(metric.field) ||
                    this.objectContainsTemplate(metric.settings) ||
                    this.objectContainsTemplate(metric.meta)) {
                    return true;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return false;
    };
    ElasticDatasource.prototype.isPrimitive = function (obj) {
        if (obj === null || obj === undefined) {
            return true;
        }
        if (['string', 'number', 'boolean'].some(function (type) { return type === typeof true; })) {
            return true;
        }
        return false;
    };
    ElasticDatasource.prototype.objectContainsTemplate = function (obj) {
        var e_4, _a, e_5, _b;
        if (!obj) {
            return false;
        }
        try {
            for (var _c = __values(Object.keys(obj)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var key = _d.value;
                if (this.isPrimitive(obj[key])) {
                    if (this.templateSrv.variableExists(obj[key])) {
                        return true;
                    }
                }
                else if (Array.isArray(obj[key])) {
                    try {
                        for (var _e = (e_5 = void 0, __values(obj[key])), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var item = _f.value;
                            if (this.objectContainsTemplate(item)) {
                                return true;
                            }
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                }
                else {
                    if (this.objectContainsTemplate(obj[key])) {
                        return true;
                    }
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return false;
    };
    return ElasticDatasource;
}(DataSourceApi));
export { ElasticDatasource };
/**
 * Modifies dataframe and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame, dataLinks, limit) {
    var e_6, _a;
    var _b;
    var dataSourceSrv = getDataSourceSrv();
    if (limit) {
        dataFrame.meta = __assign(__assign({}, dataFrame.meta), { limit: limit });
    }
    if (!dataLinks.length) {
        return;
    }
    var _loop_1 = function (field) {
        var dataLinkConfig = dataLinks.find(function (dataLink) { return field.name && field.name.match(dataLink.field); });
        if (!dataLinkConfig) {
            return "continue";
        }
        var link = void 0;
        if (dataLinkConfig.datasourceUid) {
            var dsSettings = dataSourceSrv.getInstanceSettings(dataLinkConfig.datasourceUid);
            link = {
                title: dataLinkConfig.urlDisplayLabel || '',
                url: '',
                internal: {
                    query: { query: dataLinkConfig.url },
                    datasourceUid: dataLinkConfig.datasourceUid,
                    datasourceName: (_b = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _b !== void 0 ? _b : 'Data source not found',
                },
            };
        }
        else {
            link = {
                title: dataLinkConfig.urlDisplayLabel || '',
                url: dataLinkConfig.url,
            };
        }
        field.config = field.config || {};
        field.config.links = __spreadArray(__spreadArray([], __read((field.config.links || [])), false), [link], false);
    };
    try {
        for (var _c = __values(dataFrame.fields), _d = _c.next(); !_d.done; _d = _c.next()) {
            var field = _d.value;
            _loop_1(field);
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_6) throw e_6.error; }
    }
}
function transformHitsBasedOnDirection(response, direction) {
    if (direction === 'desc') {
        return response;
    }
    var actualResponse = response.responses[0];
    return __assign(__assign({}, response), { responses: [
            __assign(__assign({}, actualResponse), { hits: __assign(__assign({}, actualResponse.hits), { hits: actualResponse.hits.hits.reverse() }) }),
        ] });
}
//# sourceMappingURL=datasource.js.map