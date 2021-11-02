import { __assign, __extends } from "tslib";
import angular from 'angular';
import { clone, compact, each, every, filter, findIndex, has, includes, isArray, isEmpty, map as _map, toPairs, } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import { DataSourceApi, dateMath, } from '@grafana/data';
import { getTemplateSrv } from 'app/features/templating/template_srv';
var OpenTsDatasource = /** @class */ (function (_super) {
    __extends(OpenTsDatasource, _super);
    function OpenTsDatasource(instanceSettings, templateSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.type = 'opentsdb';
        _this.url = instanceSettings.url;
        _this.name = instanceSettings.name;
        _this.withCredentials = instanceSettings.withCredentials;
        _this.basicAuth = instanceSettings.basicAuth;
        instanceSettings.jsonData = instanceSettings.jsonData || {};
        _this.tsdbVersion = instanceSettings.jsonData.tsdbVersion || 1;
        _this.tsdbResolution = instanceSettings.jsonData.tsdbResolution || 1;
        _this.lookupLimit = instanceSettings.jsonData.lookupLimit || 1000;
        _this.tagKeys = {};
        _this.aggregatorsPromise = null;
        _this.filterTypesPromise = null;
        return _this;
    }
    // Called once per panel (graph)
    OpenTsDatasource.prototype.query = function (options) {
        var _this = this;
        var start = this.convertToTSDBTime(options.range.raw.from, false, options.timezone);
        var end = this.convertToTSDBTime(options.range.raw.to, true, options.timezone);
        var qs = [];
        each(options.targets, function (target) {
            if (!target.metric) {
                return;
            }
            qs.push(_this.convertTargetToQuery(target, options, _this.tsdbVersion));
        });
        var queries = compact(qs);
        // No valid targets, return the empty result to save a round trip.
        if (isEmpty(queries)) {
            return of({ data: [] });
        }
        var groupByTags = {};
        each(queries, function (query) {
            if (query.filters && query.filters.length > 0) {
                each(query.filters, function (val) {
                    groupByTags[val.tagk] = true;
                });
            }
            else {
                each(query.tags, function (val, key) {
                    groupByTags[key] = true;
                });
            }
        });
        options.targets = filter(options.targets, function (query) {
            return query.hide !== true;
        });
        return this.performTimeSeriesQuery(queries, start, end).pipe(catchError(function (err) {
            var _a, _b;
            // Throw the error message here instead of the whole object to workaround the error parsing error.
            throw ((_b = (_a = err === null || err === void 0 ? void 0 : err.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message) || 'Error performing time series query.';
        }), map(function (response) {
            var metricToTargetMapping = _this.mapMetricsToTargets(response.data, options, _this.tsdbVersion);
            var result = _map(response.data, function (metricData, index) {
                index = metricToTargetMapping[index];
                if (index === -1) {
                    index = 0;
                }
                _this._saveTagKeys(metricData);
                return _this.transformMetricData(metricData, groupByTags, options.targets[index], options, _this.tsdbResolution);
            });
            return { data: result };
        }));
    };
    OpenTsDatasource.prototype.annotationQuery = function (options) {
        var start = this.convertToTSDBTime(options.rangeRaw.from, false, options.timezone);
        var end = this.convertToTSDBTime(options.rangeRaw.to, true, options.timezone);
        var qs = [];
        var eventList = [];
        qs.push({ aggregator: 'sum', metric: options.annotation.target });
        var queries = compact(qs);
        return lastValueFrom(this.performTimeSeriesQuery(queries, start, end).pipe(map(function (results) {
            if (results.data[0]) {
                var annotationObject = results.data[0].annotations;
                if (options.annotation.isGlobal) {
                    annotationObject = results.data[0].globalAnnotations;
                }
                if (annotationObject) {
                    each(annotationObject, function (annotation) {
                        var event = {
                            text: annotation.description,
                            time: Math.floor(annotation.startTime) * 1000,
                            annotation: options.annotation,
                        };
                        eventList.push(event);
                    });
                }
            }
            return eventList;
        })));
    };
    OpenTsDatasource.prototype.targetContainsTemplate = function (target) {
        if (target.filters && target.filters.length > 0) {
            for (var i = 0; i < target.filters.length; i++) {
                if (this.templateSrv.variableExists(target.filters[i].filter)) {
                    return true;
                }
            }
        }
        if (target.tags && Object.keys(target.tags).length > 0) {
            for (var tagKey in target.tags) {
                if (this.templateSrv.variableExists(target.tags[tagKey])) {
                    return true;
                }
            }
        }
        return false;
    };
    OpenTsDatasource.prototype.performTimeSeriesQuery = function (queries, start, end) {
        var msResolution = false;
        if (this.tsdbResolution === 2) {
            msResolution = true;
        }
        var reqBody = {
            start: start,
            queries: queries,
            msResolution: msResolution,
            globalAnnotations: true,
        };
        if (this.tsdbVersion === 3) {
            reqBody.showQuery = true;
        }
        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
            reqBody.end = end;
        }
        var options = {
            method: 'POST',
            url: this.url + '/api/query',
            data: reqBody,
        };
        this._addCredentialOptions(options);
        return getBackendSrv().fetch(options);
    };
    OpenTsDatasource.prototype.suggestTagKeys = function (metric) {
        return Promise.resolve(this.tagKeys[metric] || []);
    };
    OpenTsDatasource.prototype._saveTagKeys = function (metricData) {
        var tagKeys = Object.keys(metricData.tags);
        each(metricData.aggregateTags, function (tag) {
            tagKeys.push(tag);
        });
        this.tagKeys[metricData.metric] = tagKeys;
    };
    OpenTsDatasource.prototype._performSuggestQuery = function (query, type) {
        return this._get('/api/suggest', { type: type, q: query, max: this.lookupLimit }).pipe(map(function (result) {
            return result.data;
        }));
    };
    OpenTsDatasource.prototype._performMetricKeyValueLookup = function (metric, keys) {
        if (!metric || !keys) {
            return of([]);
        }
        var keysArray = keys.split(',').map(function (key) {
            return key.trim();
        });
        var key = keysArray[0];
        var keysQuery = key + '=*';
        if (keysArray.length > 1) {
            keysQuery += ',' + keysArray.splice(1).join(',');
        }
        var m = metric + '{' + keysQuery + '}';
        return this._get('/api/search/lookup', { m: m, limit: this.lookupLimit }).pipe(map(function (result) {
            result = result.data.results;
            var tagvs = [];
            each(result, function (r) {
                if (tagvs.indexOf(r.tags[key]) === -1) {
                    tagvs.push(r.tags[key]);
                }
            });
            return tagvs;
        }));
    };
    OpenTsDatasource.prototype._performMetricKeyLookup = function (metric) {
        if (!metric) {
            return of([]);
        }
        return this._get('/api/search/lookup', { m: metric, limit: 1000 }).pipe(map(function (result) {
            result = result.data.results;
            var tagks = [];
            each(result, function (r) {
                each(r.tags, function (tagv, tagk) {
                    if (tagks.indexOf(tagk) === -1) {
                        tagks.push(tagk);
                    }
                });
            });
            return tagks;
        }));
    };
    OpenTsDatasource.prototype._get = function (relativeUrl, params) {
        var options = {
            method: 'GET',
            url: this.url + relativeUrl,
            params: params,
        };
        this._addCredentialOptions(options);
        return getBackendSrv().fetch(options);
    };
    OpenTsDatasource.prototype._addCredentialOptions = function (options) {
        if (this.basicAuth || this.withCredentials) {
            options.withCredentials = true;
        }
        if (this.basicAuth) {
            options.headers = { Authorization: this.basicAuth };
        }
    };
    OpenTsDatasource.prototype.metricFindQuery = function (query) {
        if (!query) {
            return Promise.resolve([]);
        }
        var interpolated;
        try {
            interpolated = this.templateSrv.replace(query, {}, 'distributed');
        }
        catch (err) {
            return Promise.reject(err);
        }
        var responseTransform = function (result) {
            return _map(result, function (value) {
                return { text: value };
            });
        };
        var metricsRegex = /metrics\((.*)\)/;
        var tagNamesRegex = /tag_names\((.*)\)/;
        var tagValuesRegex = /tag_values\((.*?),\s?(.*)\)/;
        var tagNamesSuggestRegex = /suggest_tagk\((.*)\)/;
        var tagValuesSuggestRegex = /suggest_tagv\((.*)\)/;
        var metricsQuery = interpolated.match(metricsRegex);
        if (metricsQuery) {
            return lastValueFrom(this._performSuggestQuery(metricsQuery[1], 'metrics').pipe(map(responseTransform)));
        }
        var tagNamesQuery = interpolated.match(tagNamesRegex);
        if (tagNamesQuery) {
            return lastValueFrom(this._performMetricKeyLookup(tagNamesQuery[1]).pipe(map(responseTransform)));
        }
        var tagValuesQuery = interpolated.match(tagValuesRegex);
        if (tagValuesQuery) {
            return lastValueFrom(this._performMetricKeyValueLookup(tagValuesQuery[1], tagValuesQuery[2]).pipe(map(responseTransform)));
        }
        var tagNamesSuggestQuery = interpolated.match(tagNamesSuggestRegex);
        if (tagNamesSuggestQuery) {
            return lastValueFrom(this._performSuggestQuery(tagNamesSuggestQuery[1], 'tagk').pipe(map(responseTransform)));
        }
        var tagValuesSuggestQuery = interpolated.match(tagValuesSuggestRegex);
        if (tagValuesSuggestQuery) {
            return lastValueFrom(this._performSuggestQuery(tagValuesSuggestQuery[1], 'tagv').pipe(map(responseTransform)));
        }
        return Promise.resolve([]);
    };
    OpenTsDatasource.prototype.testDatasource = function () {
        return lastValueFrom(this._performSuggestQuery('cpu', 'metrics').pipe(map(function () {
            return { status: 'success', message: 'Data source is working' };
        })));
    };
    OpenTsDatasource.prototype.getAggregators = function () {
        if (this.aggregatorsPromise) {
            return this.aggregatorsPromise;
        }
        this.aggregatorsPromise = lastValueFrom(this._get('/api/aggregators').pipe(map(function (result) {
            if (result.data && isArray(result.data)) {
                return result.data.sort();
            }
            return [];
        })));
        return this.aggregatorsPromise;
    };
    OpenTsDatasource.prototype.getFilterTypes = function () {
        if (this.filterTypesPromise) {
            return this.filterTypesPromise;
        }
        this.filterTypesPromise = lastValueFrom(this._get('/api/config/filters').pipe(map(function (result) {
            if (result.data) {
                return Object.keys(result.data).sort();
            }
            return [];
        })));
        return this.filterTypesPromise;
    };
    OpenTsDatasource.prototype.transformMetricData = function (md, groupByTags, target, options, tsdbResolution) {
        var metricLabel = this.createMetricLabel(md, target, groupByTags, options);
        var dps = [];
        // TSDB returns datapoints has a hash of ts => value.
        // Can't use pairs(invert()) because it stringifies keys/values
        each(md.dps, function (v, k) {
            if (tsdbResolution === 2) {
                dps.push([v, k * 1]);
            }
            else {
                dps.push([v, k * 1000]);
            }
        });
        return { target: metricLabel, datapoints: dps };
    };
    OpenTsDatasource.prototype.createMetricLabel = function (md, target, groupByTags, options) {
        if (target.alias) {
            var scopedVars_1 = clone(options.scopedVars || {});
            each(md.tags, function (value, key) {
                scopedVars_1['tag_' + key] = { value: value };
            });
            return this.templateSrv.replace(target.alias, scopedVars_1);
        }
        var label = md.metric;
        var tagData = [];
        if (!isEmpty(md.tags)) {
            each(toPairs(md.tags), function (tag) {
                if (has(groupByTags, tag[0])) {
                    tagData.push(tag[0] + '=' + tag[1]);
                }
            });
        }
        if (!isEmpty(tagData)) {
            label += '{' + tagData.join(', ') + '}';
        }
        return label;
    };
    OpenTsDatasource.prototype.convertTargetToQuery = function (target, options, tsdbVersion) {
        if (!target.metric || target.hide) {
            return null;
        }
        var query = {
            metric: this.templateSrv.replace(target.metric, options.scopedVars, 'pipe'),
            aggregator: 'avg',
        };
        if (target.aggregator) {
            query.aggregator = this.templateSrv.replace(target.aggregator);
        }
        if (target.shouldComputeRate) {
            query.rate = true;
            query.rateOptions = {
                counter: !!target.isCounter,
            };
            if (target.counterMax && target.counterMax.length) {
                query.rateOptions.counterMax = parseInt(target.counterMax, 10);
            }
            if (target.counterResetValue && target.counterResetValue.length) {
                query.rateOptions.resetValue = parseInt(target.counterResetValue, 10);
            }
            if (tsdbVersion >= 2) {
                query.rateOptions.dropResets =
                    !query.rateOptions.counterMax && (!query.rateOptions.ResetValue || query.rateOptions.ResetValue === 0);
            }
        }
        if (!target.disableDownsampling) {
            var interval = this.templateSrv.replace(target.downsampleInterval || options.interval);
            if (interval.match(/\.[0-9]+s/)) {
                interval = parseFloat(interval) * 1000 + 'ms';
            }
            query.downsample = interval + '-' + target.downsampleAggregator;
            if (target.downsampleFillPolicy && target.downsampleFillPolicy !== 'none') {
                query.downsample += '-' + target.downsampleFillPolicy;
            }
        }
        if (target.filters && target.filters.length > 0) {
            query.filters = angular.copy(target.filters);
            if (query.filters) {
                for (var filterKey in query.filters) {
                    query.filters[filterKey].filter = this.templateSrv.replace(query.filters[filterKey].filter, options.scopedVars, 'pipe');
                }
            }
        }
        else {
            query.tags = angular.copy(target.tags);
            if (query.tags) {
                for (var tagKey in query.tags) {
                    query.tags[tagKey] = this.templateSrv.replace(query.tags[tagKey], options.scopedVars, 'pipe');
                }
            }
        }
        if (target.explicitTags) {
            query.explicitTags = true;
        }
        return query;
    };
    OpenTsDatasource.prototype.mapMetricsToTargets = function (metrics, options, tsdbVersion) {
        var _this = this;
        var interpolatedTagValue, arrTagV;
        return _map(metrics, function (metricData) {
            if (tsdbVersion === 3) {
                return metricData.query.index;
            }
            else {
                return findIndex(options.targets, function (target) {
                    if (target.filters && target.filters.length > 0) {
                        return target.metric === metricData.metric;
                    }
                    else {
                        return (target.metric === metricData.metric &&
                            every(target.tags, function (tagV, tagK) {
                                interpolatedTagValue = _this.templateSrv.replace(tagV, options.scopedVars, 'pipe');
                                arrTagV = interpolatedTagValue.split('|');
                                return includes(arrTagV, metricData.tags[tagK]) || interpolatedTagValue === '*';
                            }));
                    }
                });
            }
        });
    };
    OpenTsDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        if (!queries.length) {
            return queries;
        }
        return queries.map(function (query) { return (__assign(__assign({}, query), { metric: _this.templateSrv.replace(query.metric, scopedVars) })); });
    };
    OpenTsDatasource.prototype.convertToTSDBTime = function (date, roundUp, timezone) {
        if (date === 'now') {
            return null;
        }
        date = dateMath.parse(date, roundUp, timezone);
        return date.valueOf();
    };
    return OpenTsDatasource;
}(DataSourceApi));
export default OpenTsDatasource;
//# sourceMappingURL=datasource.js.map