import { __assign, __read, __spreadArray, __values } from "tslib";
import { clone, filter, find, identity, isArray, keys, map, uniq, values as _values } from 'lodash';
import flatten from 'app/core/utils/flatten';
import * as queryDef from './query_def';
import TableModel from 'app/core/table_model';
import { toDataFrame, FieldType, MutableDataFrame, } from '@grafana/data';
import { isMetricAggregationWithField, } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { describeMetric, getScriptValue } from './utils';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
var HIGHLIGHT_TAGS_EXP = queryDef.highlightTags.pre + "([^@]+)" + queryDef.highlightTags.post;
var ElasticResponse = /** @class */ (function () {
    function ElasticResponse(targets, response) {
        var _this = this;
        this.targets = targets;
        this.response = response;
        this.processResponseToSeries = function () {
            var seriesList = [];
            for (var i = 0; i < _this.response.responses.length; i++) {
                var response = _this.response.responses[i];
                var target = _this.targets[i];
                if (response.error) {
                    throw _this.getErrorFromElasticResponse(_this.response, response.error);
                }
                if (response.hits && response.hits.hits.length > 0) {
                    _this.processHits(response.hits, seriesList, target);
                }
                if (response.aggregations) {
                    var aggregations = response.aggregations;
                    var target_1 = _this.targets[i];
                    var tmpSeriesList = [];
                    var table = new TableModel();
                    table.refId = target_1.refId;
                    _this.processBuckets(aggregations, target_1, tmpSeriesList, table, {}, 0);
                    _this.trimDatapoints(tmpSeriesList, target_1);
                    _this.nameSeries(tmpSeriesList, target_1);
                    for (var y = 0; y < tmpSeriesList.length; y++) {
                        seriesList.push(tmpSeriesList[y]);
                    }
                    if (table.rows.length > 0) {
                        seriesList.push(table);
                    }
                }
            }
            return { data: seriesList };
        };
        this.targets = targets;
        this.response = response;
    }
    ElasticResponse.prototype.processMetrics = function (esAgg, target, seriesList, props) {
        var e_1, _a;
        var _b, _c, _d;
        var newSeries;
        for (var y = 0; y < target.metrics.length; y++) {
            var metric = target.metrics[y];
            if (metric.hide) {
                continue;
            }
            switch (metric.type) {
                case 'count': {
                    newSeries = { datapoints: [], metric: 'count', props: props, refId: target.refId };
                    for (var i = 0; i < esAgg.buckets.length; i++) {
                        var bucket = esAgg.buckets[i];
                        var value = bucket.doc_count;
                        newSeries.datapoints.push([value, bucket.key]);
                    }
                    seriesList.push(newSeries);
                    break;
                }
                case 'percentiles': {
                    if (esAgg.buckets.length === 0) {
                        break;
                    }
                    var firstBucket = esAgg.buckets[0];
                    var percentiles = firstBucket[metric.id].values;
                    for (var percentileName in percentiles) {
                        newSeries = {
                            datapoints: [],
                            metric: 'p' + percentileName,
                            props: props,
                            field: metric.field,
                            refId: target.refId,
                        };
                        for (var i = 0; i < esAgg.buckets.length; i++) {
                            var bucket = esAgg.buckets[i];
                            var values = bucket[metric.id].values;
                            newSeries.datapoints.push([values[percentileName], bucket.key]);
                        }
                        seriesList.push(newSeries);
                    }
                    break;
                }
                case 'extended_stats': {
                    for (var statName in metric.meta) {
                        if (!metric.meta[statName]) {
                            continue;
                        }
                        newSeries = {
                            datapoints: [],
                            metric: statName,
                            props: props,
                            field: metric.field,
                            refId: target.refId,
                        };
                        for (var i = 0; i < esAgg.buckets.length; i++) {
                            var bucket = esAgg.buckets[i];
                            var stats = bucket[metric.id];
                            // add stats that are in nested obj to top level obj
                            stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
                            stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;
                            newSeries.datapoints.push([stats[statName], bucket.key]);
                        }
                        seriesList.push(newSeries);
                    }
                    break;
                }
                case 'top_metrics': {
                    if ((_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.metrics) === null || _c === void 0 ? void 0 : _c.length) {
                        var _loop_1 = function (metricField) {
                            newSeries = {
                                datapoints: [],
                                metric: metric.type,
                                props: props,
                                refId: target.refId,
                                field: metricField,
                            };
                            for (var i = 0; i < esAgg.buckets.length; i++) {
                                var bucket = esAgg.buckets[i];
                                var stats = bucket[metric.id];
                                var values = stats.top.map(function (hit) {
                                    if (hit.metrics[metricField]) {
                                        return hit.metrics[metricField];
                                    }
                                    return null;
                                });
                                var point = [values[values.length - 1], bucket.key];
                                newSeries.datapoints.push(point);
                            }
                            seriesList.push(newSeries);
                        };
                        try {
                            for (var _e = (e_1 = void 0, __values((_d = metric.settings) === null || _d === void 0 ? void 0 : _d.metrics)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var metricField = _f.value;
                                _loop_1(metricField);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    break;
                }
                default: {
                    newSeries = {
                        datapoints: [],
                        metric: metric.type,
                        metricId: metric.id,
                        props: props,
                        refId: target.refId,
                    };
                    if (isMetricAggregationWithField(metric)) {
                        newSeries.field = metric.field;
                    }
                    for (var i = 0; i < esAgg.buckets.length; i++) {
                        var bucket = esAgg.buckets[i];
                        var value = bucket[metric.id];
                        if (value !== undefined) {
                            if (value.normalized_value) {
                                newSeries.datapoints.push([value.normalized_value, bucket.key]);
                            }
                            else {
                                newSeries.datapoints.push([value.value, bucket.key]);
                            }
                        }
                    }
                    seriesList.push(newSeries);
                    break;
                }
            }
        }
    };
    ElasticResponse.prototype.processAggregationDocs = function (esAgg, aggDef, target, table, props) {
        var e_2, _a, e_3, _b, e_4, _c, e_5, _d, e_6, _e;
        var _f;
        // add columns
        if (table.columns.length === 0) {
            try {
                for (var _g = __values(keys(props)), _h = _g.next(); !_h.done; _h = _g.next()) {
                    var propKey = _h.value;
                    table.addColumn({ text: propKey, filterable: true });
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_h && !_h.done && (_a = _g.return)) _a.call(_g);
                }
                finally { if (e_2) throw e_2.error; }
            }
            table.addColumn({ text: aggDef.field, filterable: true });
        }
        // helper func to add values to value array
        var addMetricValue = function (values, metricName, value) {
            table.addColumn({ text: metricName });
            values.push(value);
        };
        var buckets = isArray(esAgg.buckets) ? esAgg.buckets : [esAgg.buckets];
        try {
            for (var buckets_1 = __values(buckets), buckets_1_1 = buckets_1.next(); !buckets_1_1.done; buckets_1_1 = buckets_1.next()) {
                var bucket = buckets_1_1.value;
                var values = [];
                try {
                    for (var _j = (e_4 = void 0, __values(_values(props))), _k = _j.next(); !_k.done; _k = _j.next()) {
                        var propValues = _k.value;
                        values.push(propValues);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_k && !_k.done && (_c = _j.return)) _c.call(_j);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                // add bucket key (value)
                values.push(bucket.key);
                try {
                    for (var _l = (e_5 = void 0, __values(target.metrics || [])), _m = _l.next(); !_m.done; _m = _l.next()) {
                        var metric = _m.value;
                        switch (metric.type) {
                            case 'count': {
                                addMetricValue(values, this.getMetricName(metric.type), bucket.doc_count);
                                break;
                            }
                            case 'extended_stats': {
                                for (var statName in metric.meta) {
                                    if (!metric.meta[statName]) {
                                        continue;
                                    }
                                    var stats = bucket[metric.id];
                                    // add stats that are in nested obj to top level obj
                                    stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
                                    stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;
                                    addMetricValue(values, this.getMetricName(statName), stats[statName]);
                                }
                                break;
                            }
                            case 'percentiles': {
                                var percentiles = bucket[metric.id].values;
                                for (var percentileName in percentiles) {
                                    addMetricValue(values, "p" + percentileName + " " + metric.field, percentiles[percentileName]);
                                }
                                break;
                            }
                            case 'top_metrics': {
                                var baseName = this.getMetricName(metric.type);
                                if ((_f = metric.settings) === null || _f === void 0 ? void 0 : _f.metrics) {
                                    try {
                                        for (var _o = (e_6 = void 0, __values(metric.settings.metrics)), _p = _o.next(); !_p.done; _p = _o.next()) {
                                            var metricField = _p.value;
                                            // If we selected more than one metric we also add each metric name
                                            var metricName = metric.settings.metrics.length > 1 ? baseName + " " + metricField : baseName;
                                            var stats = bucket[metric.id];
                                            // Size of top_metrics is fixed to 1.
                                            addMetricValue(values, metricName, stats.top[0].metrics[metricField]);
                                        }
                                    }
                                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                                    finally {
                                        try {
                                            if (_p && !_p.done && (_e = _o.return)) _e.call(_o);
                                        }
                                        finally { if (e_6) throw e_6.error; }
                                    }
                                }
                                break;
                            }
                            default: {
                                var metricName = this.getMetricName(metric.type);
                                var otherMetrics = filter(target.metrics, { type: metric.type });
                                // if more of the same metric type include field field name in property
                                if (otherMetrics.length > 1) {
                                    if (isMetricAggregationWithField(metric)) {
                                        metricName += ' ' + metric.field;
                                    }
                                    if (metric.type === 'bucket_script') {
                                        //Use the formula in the column name
                                        metricName = getScriptValue(metric);
                                    }
                                }
                                addMetricValue(values, metricName, bucket[metric.id].value);
                                break;
                            }
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_m && !_m.done && (_d = _l.return)) _d.call(_l);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                table.rows.push(values);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (buckets_1_1 && !buckets_1_1.done && (_b = buckets_1.return)) _b.call(buckets_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    // This is quite complex
    // need to recurse down the nested buckets to build series
    ElasticResponse.prototype.processBuckets = function (aggs, target, seriesList, table, props, depth) {
        var bucket, aggDef, esAgg, aggId;
        var maxDepth = target.bucketAggs.length - 1;
        for (aggId in aggs) {
            aggDef = find(target.bucketAggs, { id: aggId });
            esAgg = aggs[aggId];
            if (!aggDef) {
                continue;
            }
            if (depth === maxDepth) {
                if (aggDef.type === 'date_histogram') {
                    this.processMetrics(esAgg, target, seriesList, props);
                }
                else {
                    this.processAggregationDocs(esAgg, aggDef, target, table, props);
                }
            }
            else {
                for (var nameIndex in esAgg.buckets) {
                    bucket = esAgg.buckets[nameIndex];
                    props = clone(props);
                    if (bucket.key !== void 0) {
                        props[aggDef.field] = bucket.key;
                    }
                    else {
                        props['filter'] = nameIndex;
                    }
                    if (bucket.key_as_string) {
                        props[aggDef.field] = bucket.key_as_string;
                    }
                    this.processBuckets(bucket, target, seriesList, table, props, depth + 1);
                }
            }
        }
    };
    ElasticResponse.prototype.getMetricName = function (metric) {
        var metricDef = Object.entries(metricAggregationConfig)
            .filter(function (_a) {
            var _b = __read(_a, 1), key = _b[0];
            return key === metric;
        })
            .map(function (_a) {
            var _b = __read(_a, 2), _ = _b[0], value = _b[1];
            return value;
        })[0];
        if (metricDef) {
            return metricDef.label;
        }
        var extendedStat = queryDef.extendedStats.find(function (e) { return e.value === metric; });
        if (extendedStat) {
            return extendedStat.label;
        }
        return metric;
    };
    ElasticResponse.prototype.getSeriesName = function (series, target, dedup) {
        var e_7, _a;
        var metricName = this.getMetricName(series.metric);
        if (target.alias) {
            var regex = /\{\{([\s\S]+?)\}\}/g;
            return target.alias.replace(regex, function (match, g1, g2) {
                var group = g1 || g2;
                if (group.indexOf('term ') === 0) {
                    return series.props[group.substring(5)];
                }
                if (series.props[group] !== void 0) {
                    return series.props[group];
                }
                if (group === 'metric') {
                    return metricName;
                }
                if (group === 'field') {
                    return series.field || '';
                }
                return match;
            });
        }
        if (queryDef.isPipelineAgg(series.metric)) {
            if (series.metric && queryDef.isPipelineAggWithMultipleBucketPaths(series.metric)) {
                var agg = find(target.metrics, { id: series.metricId });
                if (agg && agg.settings.script) {
                    metricName = getScriptValue(agg);
                    try {
                        for (var _b = __values(agg.pipelineVariables), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var pv = _c.value;
                            var appliedAgg = find(target.metrics, { id: pv.pipelineAgg });
                            if (appliedAgg) {
                                metricName = metricName.replace('params.' + pv.name, describeMetric(appliedAgg));
                            }
                        }
                    }
                    catch (e_7_1) { e_7 = { error: e_7_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_7) throw e_7.error; }
                    }
                }
                else {
                    metricName = 'Unset';
                }
            }
            else {
                var appliedAgg = find(target.metrics, { id: series.field });
                if (appliedAgg) {
                    metricName += ' ' + describeMetric(appliedAgg);
                }
                else {
                    metricName = 'Unset';
                }
            }
        }
        else if (series.field) {
            metricName += ' ' + series.field;
        }
        var propKeys = keys(series.props);
        if (propKeys.length === 0) {
            return metricName;
        }
        var name = '';
        for (var propName in series.props) {
            name += series.props[propName] + ' ';
        }
        if (dedup) {
            return name.trim() + ' ' + metricName;
        }
        return name.trim();
    };
    ElasticResponse.prototype.nameSeries = function (seriesList, target) {
        var _a;
        var metricTypeCount = uniq(map(seriesList, 'metric')).length;
        var hasTopMetricWithMultipleMetrics = ((_a = target.metrics) === null || _a === void 0 ? void 0 : _a.filter(function (m) { return m.type === 'top_metrics'; })).some(function (m) { var _a, _b; return (((_b = (_a = m === null || m === void 0 ? void 0 : m.settings) === null || _a === void 0 ? void 0 : _a.metrics) === null || _b === void 0 ? void 0 : _b.length) || 0) > 1; });
        for (var i = 0; i < seriesList.length; i++) {
            var series = seriesList[i];
            series.target = this.getSeriesName(series, target, metricTypeCount > 1 || hasTopMetricWithMultipleMetrics);
        }
    };
    ElasticResponse.prototype.processHits = function (hits, seriesList, target) {
        var hitsTotal = typeof hits.total === 'number' ? hits.total : hits.total.value; // <- Works with Elasticsearch 7.0+
        var series = {
            target: target.refId,
            type: 'docs',
            refId: target.refId,
            datapoints: [],
            total: hitsTotal,
            filterable: true,
        };
        var propName, hit, doc, i;
        for (i = 0; i < hits.hits.length; i++) {
            hit = hits.hits[i];
            doc = {
                _id: hit._id,
                _type: hit._type,
                _index: hit._index,
                sort: hit.sort,
                highlight: hit.highlight,
            };
            if (hit._source) {
                for (propName in hit._source) {
                    doc[propName] = hit._source[propName];
                }
            }
            for (propName in hit.fields) {
                doc[propName] = hit.fields[propName];
            }
            series.datapoints.push(doc);
        }
        seriesList.push(series);
    };
    ElasticResponse.prototype.trimDatapoints = function (aggregations, target) {
        var histogram = find(target.bucketAggs, { type: 'date_histogram' });
        var shouldDropFirstAndLast = histogram && histogram.settings && histogram.settings.trimEdges;
        if (shouldDropFirstAndLast) {
            var trim = histogram.settings.trimEdges;
            for (var prop in aggregations) {
                var points = aggregations[prop];
                if (points.datapoints.length > trim * 2) {
                    points.datapoints = points.datapoints.slice(trim, points.datapoints.length - trim);
                }
            }
        }
    };
    ElasticResponse.prototype.getErrorFromElasticResponse = function (response, err) {
        var result = {};
        result.data = JSON.stringify(err, null, 4);
        if (err.root_cause && err.root_cause.length > 0 && err.root_cause[0].reason) {
            result.message = err.root_cause[0].reason;
        }
        else {
            result.message = err.reason || 'Unknown elastic error response';
        }
        if (response.$$config) {
            result.config = response.$$config;
        }
        return result;
    };
    ElasticResponse.prototype.getTimeSeries = function () {
        if (this.targets.some(function (target) { return queryDef.hasMetricOfType(target, 'raw_data'); })) {
            return this.processResponseToDataFrames(false);
        }
        return this.processResponseToSeries();
    };
    ElasticResponse.prototype.getLogs = function (logMessageField, logLevelField) {
        return this.processResponseToDataFrames(true, logMessageField, logLevelField);
    };
    ElasticResponse.prototype.processResponseToDataFrames = function (isLogsRequest, logMessageField, logLevelField) {
        var e_8, _a;
        var _b;
        var dataFrame = [];
        for (var n = 0; n < this.response.responses.length; n++) {
            var response = this.response.responses[n];
            if (response.error) {
                throw this.getErrorFromElasticResponse(this.response, response.error);
            }
            if (response.hits) {
                var _c = flattenHits(response.hits.hits), propNames = _c.propNames, docs = _c.docs;
                var series = docs.length
                    ? createEmptyDataFrame(propNames.map(toNameTypePair(docs)), isLogsRequest, this.targets[0].timeField, logMessageField, logLevelField)
                    : createEmptyDataFrame([], isLogsRequest);
                if (isLogsRequest) {
                    addPreferredVisualisationType(series, 'logs');
                }
                var _loop_2 = function (doc) {
                    if (logLevelField) {
                        // Remap level field based on the datasource config. This field is
                        // then used in explore to figure out the log level. We may rewrite
                        // some actual data in the level field if they are different.
                        doc['level'] = doc[logLevelField];
                    }
                    // When highlighting exists, we need to collect all the highlighted
                    // phrases and add them to the DataFrame's meta.searchWords array.
                    if (doc.highlight) {
                        // There might be multiple words so we need two versions of the
                        // regular expression. One to match gobally, when used with part.match,
                        // it returns and array of matches. The second one is used to capture the
                        // values between the tags.
                        var globalHighlightWordRegex_1 = new RegExp(HIGHLIGHT_TAGS_EXP, 'g');
                        var highlightWordRegex_1 = new RegExp(HIGHLIGHT_TAGS_EXP);
                        var newSearchWords = Object.keys(doc.highlight)
                            .flatMap(function (key) {
                            return doc.highlight[key].flatMap(function (line) {
                                var matchedPhrases = line.match(globalHighlightWordRegex_1);
                                if (!matchedPhrases) {
                                    return [];
                                }
                                return matchedPhrases.map(function (part) {
                                    var matches = part.match(highlightWordRegex_1);
                                    return (matches && matches[1]) || null;
                                });
                            });
                        })
                            .filter(identity);
                        // If meta and searchWords already exists, add the words and
                        // deduplicate otherwise create a new set of search words.
                        var searchWords = ((_b = series.meta) === null || _b === void 0 ? void 0 : _b.searchWords)
                            ? uniq(__spreadArray(__spreadArray([], __read(series.meta.searchWords), false), __read(newSearchWords), false))
                            : __spreadArray([], __read(newSearchWords), false);
                        series.meta = series.meta ? __assign(__assign({}, series.meta), { searchWords: searchWords }) : { searchWords: searchWords };
                    }
                    series.add(doc);
                };
                try {
                    // Add a row for each document
                    for (var docs_1 = (e_8 = void 0, __values(docs)), docs_1_1 = docs_1.next(); !docs_1_1.done; docs_1_1 = docs_1.next()) {
                        var doc = docs_1_1.value;
                        _loop_2(doc);
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (docs_1_1 && !docs_1_1.done && (_a = docs_1.return)) _a.call(docs_1);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
                var target = this.targets[n];
                series.refId = target.refId;
                dataFrame.push(series);
            }
            if (response.aggregations) {
                var aggregations = response.aggregations;
                var target = this.targets[n];
                var tmpSeriesList = [];
                var table = new TableModel();
                this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
                this.trimDatapoints(tmpSeriesList, target);
                this.nameSeries(tmpSeriesList, target);
                if (table.rows.length > 0) {
                    var series = toDataFrame(table);
                    series.refId = target.refId;
                    dataFrame.push(series);
                }
                for (var y = 0; y < tmpSeriesList.length; y++) {
                    var series = toDataFrame(tmpSeriesList[y]);
                    // When log results, show aggregations only in graph. Log fields are then going to be shown in table.
                    if (isLogsRequest) {
                        addPreferredVisualisationType(series, 'graph');
                    }
                    series.refId = target.refId;
                    dataFrame.push(series);
                }
            }
        }
        return { data: dataFrame };
    };
    return ElasticResponse;
}());
export { ElasticResponse };
/**
 * Flatten the docs from response mainly the _source part which can be nested. This flattens it so that it is one level
 * deep and the keys are: `level1Name.level2Name...`. Also returns list of all properties from all the docs (not all
 * docs have to have the same keys).
 * @param hits
 */
var flattenHits = function (hits) {
    var e_9, _a, e_10, _b;
    var docs = [];
    // We keep a list of all props so that we can create all the fields in the dataFrame, this can lead
    // to wide sparse dataframes in case the scheme is different per document.
    var propNames = [];
    try {
        for (var hits_1 = __values(hits), hits_1_1 = hits_1.next(); !hits_1_1.done; hits_1_1 = hits_1.next()) {
            var hit = hits_1_1.value;
            var flattened = hit._source ? flatten(hit._source) : {};
            var doc = __assign({ _id: hit._id, _type: hit._type, _index: hit._index, sort: hit.sort, highlight: hit.highlight, _source: __assign({}, flattened) }, flattened);
            try {
                for (var _c = (e_10 = void 0, __values(Object.keys(doc))), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var propName = _d.value;
                    if (propNames.indexOf(propName) === -1) {
                        propNames.push(propName);
                    }
                }
            }
            catch (e_10_1) { e_10 = { error: e_10_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_10) throw e_10.error; }
            }
            docs.push(doc);
        }
    }
    catch (e_9_1) { e_9 = { error: e_9_1 }; }
    finally {
        try {
            if (hits_1_1 && !hits_1_1.done && (_a = hits_1.return)) _a.call(hits_1);
        }
        finally { if (e_9) throw e_9.error; }
    }
    propNames.sort();
    return { docs: docs, propNames: propNames };
};
/**
 * Create empty dataframe but with created fields. Fields are based from propNames (should be from the response) and
 * also from configuration specified fields for message, time, and level.
 * @param propNames
 * @param timeField
 * @param logMessageField
 * @param logLevelField
 */
var createEmptyDataFrame = function (props, isLogsRequest, timeField, logMessageField, logLevelField) {
    var e_11, _a;
    var series = new MutableDataFrame({ fields: [] });
    if (timeField) {
        series.addField({
            config: {
                filterable: true,
            },
            name: timeField,
            type: FieldType.time,
        });
    }
    if (logMessageField) {
        series.addField({
            name: logMessageField,
            type: FieldType.string,
        }).parse = function (v) {
            return v || '';
        };
    }
    if (logLevelField) {
        series.addField({
            name: 'level',
            type: FieldType.string,
        }).parse = function (v) {
            return v || '';
        };
    }
    var fieldNames = series.fields.map(function (field) { return field.name; });
    try {
        for (var props_1 = __values(props), props_1_1 = props_1.next(); !props_1_1.done; props_1_1 = props_1.next()) {
            var _b = __read(props_1_1.value, 2), name_1 = _b[0], type = _b[1];
            // Do not duplicate fields. This can mean that we will shadow some fields.
            if (fieldNames.includes(name_1)) {
                continue;
            }
            // Do not add _source field (besides logs) as we are showing each _source field in table instead.
            if (!isLogsRequest && name_1 === '_source') {
                continue;
            }
            series.addField({
                config: {
                    filterable: true,
                },
                name: name_1,
                type: type,
            }).parse = function (v) {
                return v || '';
            };
        }
    }
    catch (e_11_1) { e_11 = { error: e_11_1 }; }
    finally {
        try {
            if (props_1_1 && !props_1_1.done && (_a = props_1.return)) _a.call(props_1);
        }
        finally { if (e_11) throw e_11.error; }
    }
    return series;
};
var addPreferredVisualisationType = function (series, type) {
    var s = series;
    s.meta
        ? (s.meta.preferredVisualisationType = type)
        : (s.meta = {
            preferredVisualisationType: type,
        });
};
var toNameTypePair = function (docs) { return function (propName) {
    var _a;
    return [
        propName,
        guessType((_a = docs.find(function (doc) { return doc[propName] !== undefined; })) === null || _a === void 0 ? void 0 : _a[propName]),
    ];
}; };
/**
 * Trying to guess data type from its value. This is far from perfect, as in order to have accurate guess
 * we should have access to the elasticsearch mapping, but it covers the most common use cases for numbers, strings & arrays.
 */
var guessType = function (value) {
    switch (typeof value) {
        case 'number':
            return FieldType.number;
        case 'string':
            return FieldType.string;
        default:
            return FieldType.other;
    }
};
//# sourceMappingURL=elastic_response.js.map