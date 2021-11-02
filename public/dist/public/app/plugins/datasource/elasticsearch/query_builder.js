import { __assign, __read, __values } from "tslib";
import { gte, lt } from 'semver';
import { isMetricAggregationWithField, isMetricAggregationWithSettings, isMovingAverageWithModelSettings, isPipelineAggregation, isPipelineAggregationWithMultipleBucketPaths, } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { defaultBucketAgg, defaultMetricAgg, findMetricById, highlightTags } from './query_def';
import { convertOrderByToMetricId, getScriptValue } from './utils';
var ElasticQueryBuilder = /** @class */ (function () {
    function ElasticQueryBuilder(options) {
        this.timeField = options.timeField;
        this.esVersion = options.esVersion;
    }
    ElasticQueryBuilder.prototype.getRangeFilter = function () {
        var filter = {};
        filter[this.timeField] = {
            gte: '$timeFrom',
            lte: '$timeTo',
            format: 'epoch_millis',
        };
        return filter;
    };
    ElasticQueryBuilder.prototype.buildTermsAgg = function (aggDef, queryNode, target) {
        var e_1, _a, _b;
        var _c;
        queryNode.terms = { field: aggDef.field };
        if (!aggDef.settings) {
            return queryNode;
        }
        // TODO: This default should be somewhere else together with the one used in the UI
        var size = ((_c = aggDef.settings) === null || _c === void 0 ? void 0 : _c.size) ? parseInt(aggDef.settings.size, 10) : 500;
        queryNode.terms.size = size === 0 ? 500 : size;
        if (aggDef.settings.orderBy !== void 0) {
            queryNode.terms.order = {};
            if (aggDef.settings.orderBy === '_term' && gte(this.esVersion, '6.0.0')) {
                queryNode.terms.order['_key'] = aggDef.settings.order;
            }
            else {
                queryNode.terms.order[aggDef.settings.orderBy] = aggDef.settings.order;
            }
            // if metric ref, look it up and add it to this agg level
            var metricId = convertOrderByToMetricId(aggDef.settings.orderBy);
            if (metricId) {
                try {
                    for (var _d = __values(target.metrics || []), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var metric = _e.value;
                        if (metric.id === metricId) {
                            if (metric.type === 'count') {
                                queryNode.terms.order = { _count: aggDef.settings.order };
                            }
                            else if (isMetricAggregationWithField(metric)) {
                                queryNode.aggs = {};
                                queryNode.aggs[metric.id] = (_b = {},
                                    _b[metric.type] = { field: metric.field },
                                    _b);
                            }
                            break;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
        }
        if (aggDef.settings.min_doc_count !== void 0) {
            queryNode.terms.min_doc_count = parseInt(aggDef.settings.min_doc_count, 10);
            if (isNaN(queryNode.terms.min_doc_count)) {
                queryNode.terms.min_doc_count = aggDef.settings.min_doc_count;
            }
        }
        if (aggDef.settings.missing) {
            queryNode.terms.missing = aggDef.settings.missing;
        }
        return queryNode;
    };
    ElasticQueryBuilder.prototype.getDateHistogramAgg = function (aggDef) {
        var esAgg = {};
        var settings = aggDef.settings || {};
        esAgg.interval = settings.interval;
        esAgg.field = this.timeField;
        esAgg.min_doc_count = settings.min_doc_count || 0;
        esAgg.extended_bounds = { min: '$timeFrom', max: '$timeTo' };
        esAgg.format = 'epoch_millis';
        if (settings.offset !== '') {
            esAgg.offset = settings.offset;
        }
        if (esAgg.interval === 'auto') {
            esAgg.interval = '$__interval';
        }
        return esAgg;
    };
    ElasticQueryBuilder.prototype.getHistogramAgg = function (aggDef) {
        var esAgg = {};
        var settings = aggDef.settings || {};
        esAgg.interval = settings.interval;
        esAgg.field = aggDef.field;
        esAgg.min_doc_count = settings.min_doc_count || 0;
        return esAgg;
    };
    ElasticQueryBuilder.prototype.getFiltersAgg = function (aggDef) {
        var e_2, _a;
        var _b;
        var filterObj = {};
        try {
            for (var _c = __values(((_b = aggDef.settings) === null || _b === void 0 ? void 0 : _b.filters) || []), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, query = _e.query, label = _e.label;
                filterObj[label || query] = {
                    query_string: {
                        query: query,
                        analyze_wildcard: true,
                    },
                };
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return filterObj;
    };
    ElasticQueryBuilder.prototype.documentQuery = function (query, size) {
        var _a;
        query.size = size;
        query.sort = [
            (_a = {},
                _a[this.timeField] = { order: 'desc', unmapped_type: 'boolean' },
                _a),
            {
                _doc: { order: 'desc' },
            },
        ];
        // fields field not supported on ES 5.x
        if (lt(this.esVersion, '5.0.0')) {
            query.fields = ['*', '_source'];
        }
        query.script_fields = {};
        return query;
    };
    ElasticQueryBuilder.prototype.addAdhocFilters = function (query, adhocFilters) {
        if (!adhocFilters) {
            return;
        }
        var i, filter, condition, queryCondition;
        for (i = 0; i < adhocFilters.length; i++) {
            filter = adhocFilters[i];
            condition = {};
            condition[filter.key] = filter.value;
            queryCondition = {};
            queryCondition[filter.key] = { query: filter.value };
            switch (filter.operator) {
                case '=':
                    if (!query.query.bool.must) {
                        query.query.bool.must = [];
                    }
                    query.query.bool.must.push({ match_phrase: queryCondition });
                    break;
                case '!=':
                    if (!query.query.bool.must_not) {
                        query.query.bool.must_not = [];
                    }
                    query.query.bool.must_not.push({ match_phrase: queryCondition });
                    break;
                case '<':
                    condition[filter.key] = { lt: filter.value };
                    query.query.bool.filter.push({ range: condition });
                    break;
                case '>':
                    condition[filter.key] = { gt: filter.value };
                    query.query.bool.filter.push({ range: condition });
                    break;
                case '=~':
                    query.query.bool.filter.push({ regexp: condition });
                    break;
                case '!~':
                    query.query.bool.filter.push({
                        bool: { must_not: { regexp: condition } },
                    });
                    break;
            }
        }
    };
    ElasticQueryBuilder.prototype.build = function (target, adhocFilters, queryString) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // make sure query has defaults;
        target.metrics = target.metrics || [defaultMetricAgg()];
        target.bucketAggs = target.bucketAggs || [defaultBucketAgg()];
        target.timeField = this.timeField;
        var metric;
        var i, j, pv, nestedAggs;
        var query = {
            size: 0,
            query: {
                bool: {
                    filter: [
                        { range: this.getRangeFilter() },
                        {
                            query_string: {
                                analyze_wildcard: true,
                                query: queryString,
                            },
                        },
                    ],
                },
            },
        };
        this.addAdhocFilters(query, adhocFilters);
        // If target doesn't have bucketAggs and type is not raw_document, it is invalid query.
        if (target.bucketAggs.length === 0) {
            metric = target.metrics[0];
            if (!metric || !(metric.type === 'raw_document' || metric.type === 'raw_data')) {
                throw { message: 'Invalid query' };
            }
        }
        /* Handle document query:
         * Check if metric type is raw_document. If metric doesn't have size (or size is 0), update size to 500.
         * Otherwise it will not be a valid query and error will be thrown.
         */
        if (((_b = (_a = target.metrics) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.type) === 'raw_document' || ((_d = (_c = target.metrics) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.type) === 'raw_data') {
            metric = target.metrics[0];
            // TODO: This default should be somewhere else together with the one used in the UI
            var size = ((_e = metric.settings) === null || _e === void 0 ? void 0 : _e.size) ? parseInt(metric.settings.size, 10) : 500;
            return this.documentQuery(query, size || 500);
        }
        nestedAggs = query;
        for (i = 0; i < target.bucketAggs.length; i++) {
            var aggDef = target.bucketAggs[i];
            var esAgg = {};
            switch (aggDef.type) {
                case 'date_histogram': {
                    esAgg['date_histogram'] = this.getDateHistogramAgg(aggDef);
                    break;
                }
                case 'histogram': {
                    esAgg['histogram'] = this.getHistogramAgg(aggDef);
                    break;
                }
                case 'filters': {
                    esAgg['filters'] = { filters: this.getFiltersAgg(aggDef) };
                    break;
                }
                case 'terms': {
                    this.buildTermsAgg(aggDef, esAgg, target);
                    break;
                }
                case 'geohash_grid': {
                    esAgg['geohash_grid'] = {
                        field: aggDef.field,
                        precision: (_f = aggDef.settings) === null || _f === void 0 ? void 0 : _f.precision,
                    };
                    break;
                }
            }
            nestedAggs.aggs = nestedAggs.aggs || {};
            nestedAggs.aggs[aggDef.id] = esAgg;
            nestedAggs = esAgg;
        }
        nestedAggs.aggs = {};
        var _loop_1 = function () {
            var _m;
            metric = target.metrics[i];
            if (metric.type === 'count') {
                return "continue";
            }
            var aggField = {};
            var metricAgg = {};
            if (isPipelineAggregation(metric)) {
                if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
                    if (metric.pipelineVariables) {
                        metricAgg = {
                            buckets_path: {},
                        };
                        for (j = 0; j < metric.pipelineVariables.length; j++) {
                            pv = metric.pipelineVariables[j];
                            if (pv.name && pv.pipelineAgg && /^\d*$/.test(pv.pipelineAgg)) {
                                var appliedAgg = findMetricById(target.metrics, pv.pipelineAgg);
                                if (appliedAgg) {
                                    if (appliedAgg.type === 'count') {
                                        metricAgg.buckets_path[pv.name] = '_count';
                                    }
                                    else {
                                        metricAgg.buckets_path[pv.name] = pv.pipelineAgg;
                                    }
                                }
                            }
                        }
                    }
                    else {
                        return "continue";
                    }
                }
                else {
                    if (metric.field && /^\d*$/.test(metric.field)) {
                        var appliedAgg = findMetricById(target.metrics, metric.field);
                        if (appliedAgg) {
                            if (appliedAgg.type === 'count') {
                                metricAgg = { buckets_path: '_count' };
                            }
                            else {
                                metricAgg = { buckets_path: metric.field };
                            }
                        }
                    }
                    else {
                        return "continue";
                    }
                }
            }
            else if (isMetricAggregationWithField(metric)) {
                metricAgg = { field: metric.field };
            }
            if (isMetricAggregationWithSettings(metric)) {
                Object.entries(metric.settings || {})
                    .filter(function (_a) {
                    var _b = __read(_a, 2), _ = _b[0], v = _b[1];
                    return v !== null;
                })
                    .forEach(function (_a) {
                    var _b = __read(_a, 2), k = _b[0], v = _b[1];
                    metricAgg[k] =
                        k === 'script' ? _this.buildScript(getScriptValue(metric)) : v;
                });
                // Elasticsearch isn't generally too picky about the data types in the request body,
                // however some fields are required to be numeric.
                // Users might have already created some of those with before, where the values were numbers.
                switch (metric.type) {
                    case 'moving_avg':
                        metricAgg = __assign(__assign(__assign(__assign({}, metricAgg), ((metricAgg === null || metricAgg === void 0 ? void 0 : metricAgg.window) !== undefined && { window: this_1.toNumber(metricAgg.window) })), ((metricAgg === null || metricAgg === void 0 ? void 0 : metricAgg.predict) !== undefined && { predict: this_1.toNumber(metricAgg.predict) })), (isMovingAverageWithModelSettings(metric) && {
                            settings: __assign(__assign({}, metricAgg.settings), Object.fromEntries(Object.entries(metricAgg.settings || {})
                                // Only format properties that are required to be numbers
                                .filter(function (_a) {
                                var _b = __read(_a, 1), settingName = _b[0];
                                return ['alpha', 'beta', 'gamma', 'period'].includes(settingName);
                            })
                                // omitting undefined
                                .filter(function (_a) {
                                var _b = __read(_a, 2), _ = _b[0], stringValue = _b[1];
                                return stringValue !== undefined;
                            })
                                .map(function (_a) {
                                var _b = __read(_a, 2), _ = _b[0], stringValue = _b[1];
                                return [_, _this.toNumber(stringValue)];
                            }))),
                        }));
                        break;
                    case 'serial_diff':
                        metricAgg = __assign(__assign({}, metricAgg), (metricAgg.lag !== undefined && {
                            lag: this_1.toNumber(metricAgg.lag),
                        }));
                        break;
                    case 'top_metrics':
                        metricAgg = {
                            metrics: (_h = (_g = metric.settings) === null || _g === void 0 ? void 0 : _g.metrics) === null || _h === void 0 ? void 0 : _h.map(function (field) { return ({ field: field }); }),
                            size: 1,
                        };
                        if ((_j = metric.settings) === null || _j === void 0 ? void 0 : _j.orderBy) {
                            metricAgg.sort = [(_m = {}, _m[(_k = metric.settings) === null || _k === void 0 ? void 0 : _k.orderBy] = (_l = metric.settings) === null || _l === void 0 ? void 0 : _l.order, _m)];
                        }
                        break;
                }
            }
            aggField[metric.type] = metricAgg;
            nestedAggs.aggs[metric.id] = aggField;
        };
        var this_1 = this;
        for (i = 0; i < target.metrics.length; i++) {
            _loop_1();
        }
        return query;
    };
    ElasticQueryBuilder.prototype.buildScript = function (script) {
        if (gte(this.esVersion, '5.6.0')) {
            return script;
        }
        return {
            inline: script,
        };
    };
    ElasticQueryBuilder.prototype.toNumber = function (stringValue) {
        var parsedValue = parseFloat("" + stringValue);
        if (isNaN(parsedValue)) {
            return stringValue;
        }
        return parsedValue;
    };
    ElasticQueryBuilder.prototype.getTermsQuery = function (queryDef) {
        var query = {
            size: 0,
            query: {
                bool: {
                    filter: [{ range: this.getRangeFilter() }],
                },
            },
        };
        if (queryDef.query) {
            query.query.bool.filter.push({
                query_string: {
                    analyze_wildcard: true,
                    query: queryDef.query,
                },
            });
        }
        var size = 500;
        if (queryDef.size) {
            size = queryDef.size;
        }
        query.aggs = {
            '1': {
                terms: {
                    field: queryDef.field,
                    size: size,
                    order: {},
                },
            },
        };
        // Default behaviour is to order results by { _key: asc }
        // queryDef.order allows selection of asc/desc
        // queryDef.orderBy allows selection of doc_count ordering (defaults desc)
        var _a = queryDef.orderBy, orderBy = _a === void 0 ? 'key' : _a, _b = queryDef.order, order = _b === void 0 ? orderBy === 'doc_count' ? 'desc' : 'asc' : _b;
        if (['asc', 'desc'].indexOf(order) < 0) {
            throw { message: "Invalid query sort order " + order };
        }
        switch (orderBy) {
            case 'key':
            case 'term':
                var keyname = gte(this.esVersion, '6.0.0') ? '_key' : '_term';
                query.aggs['1'].terms.order[keyname] = order;
                break;
            case 'doc_count':
                query.aggs['1'].terms.order['_count'] = order;
                break;
            default:
                throw { message: "Invalid query sort type " + orderBy };
        }
        return query;
    };
    ElasticQueryBuilder.prototype.getLogsQuery = function (target, limit, adhocFilters, querystring) {
        var query = {
            size: 0,
            query: {
                bool: {
                    filter: [{ range: this.getRangeFilter() }],
                },
            },
        };
        this.addAdhocFilters(query, adhocFilters);
        if (target.query) {
            query.query.bool.filter.push({
                query_string: {
                    analyze_wildcard: true,
                    query: querystring,
                },
            });
        }
        query = this.documentQuery(query, limit);
        return __assign(__assign({}, query), { aggs: this.build(target, null, querystring).aggs, highlight: {
                fields: {
                    '*': {},
                },
                pre_tags: [highlightTags.pre],
                post_tags: [highlightTags.post],
                fragment_size: 2147483647,
            } });
    };
    return ElasticQueryBuilder;
}());
export { ElasticQueryBuilder };
//# sourceMappingURL=query_builder.js.map