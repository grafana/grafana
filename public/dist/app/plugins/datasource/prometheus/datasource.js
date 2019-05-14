import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
import $ from 'jquery';
// Services & Utils
import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';
import PrometheusMetricFindQuery from './metric_find_query';
import { ResultTransformer } from './result_transformer';
import PrometheusLanguageProvider from './language_provider';
import addLabelToQuery from './add_label_to_query';
import { getQueryHints } from './query_hints';
import { expandRecordingRules } from './language_utils';
var PrometheusDatasource = /** @class */ (function () {
    /** @ngInject */
    function PrometheusDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
        this.$q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.type = 'prometheus';
        this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
        this.name = instanceSettings.name;
        this.url = instanceSettings.url;
        this.directUrl = instanceSettings.directUrl;
        this.basicAuth = instanceSettings.basicAuth;
        this.withCredentials = instanceSettings.withCredentials;
        this.interval = instanceSettings.jsonData.timeInterval || '15s';
        this.queryTimeout = instanceSettings.jsonData.queryTimeout;
        this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
        this.resultTransformer = new ResultTransformer(templateSrv);
        this.ruleMappings = {};
        this.languageProvider = new PrometheusLanguageProvider(this);
    }
    PrometheusDatasource.prototype.init = function () {
        this.loadRules();
    };
    PrometheusDatasource.prototype._request = function (url, data, options) {
        options = _.defaults(options || {}, {
            url: this.url + url,
            method: this.httpMethod,
        });
        if (options.method === 'GET') {
            if (!_.isEmpty(data)) {
                options.url =
                    options.url +
                        '?' +
                        _.map(data, function (v, k) {
                            return encodeURIComponent(k) + '=' + encodeURIComponent(v);
                        }).join('&');
            }
        }
        else {
            options.headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
            options.transformRequest = function (data) {
                return $.param(data);
            };
            options.data = data;
        }
        if (this.basicAuth || this.withCredentials) {
            options.withCredentials = true;
        }
        if (this.basicAuth) {
            options.headers = {
                Authorization: this.basicAuth,
            };
        }
        return this.backendSrv.datasourceRequest(options);
    };
    // Use this for tab completion features, wont publish response to other components
    PrometheusDatasource.prototype.metadataRequest = function (url) {
        return this._request(url, null, { method: 'GET', silent: true });
    };
    PrometheusDatasource.prototype.interpolateQueryExpr = function (value, variable, defaultFormatFn) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return prometheusRegularEscape(value);
        }
        if (typeof value === 'string') {
            return prometheusSpecialRegexEscape(value);
        }
        var escapedValues = _.map(value, prometheusSpecialRegexEscape);
        return escapedValues.join('|');
    };
    PrometheusDatasource.prototype.targetContainsTemplate = function (target) {
        return this.templateSrv.variableExists(target.expr);
    };
    PrometheusDatasource.prototype.query = function (options) {
        var _this = this;
        var e_1, _a;
        var start = this.getPrometheusTime(options.range.from, false);
        var end = this.getPrometheusTime(options.range.to, true);
        var queries = [];
        var activeTargets = [];
        options = _.clone(options);
        try {
            for (var _b = tslib_1.__values(options.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
                var target = _c.value;
                if (!target.expr || target.hide) {
                    continue;
                }
                activeTargets.push(target);
                queries.push(this.createQuery(target, options, start, end));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // No valid targets, return the empty result to save a round trip.
        if (_.isEmpty(queries)) {
            return this.$q.when({ data: [] });
        }
        var allQueryPromise = _.map(queries, function (query) {
            if (!query.instant) {
                return _this.performTimeSeriesQuery(query, query.start, query.end);
            }
            else {
                return _this.performInstantQuery(query, end);
            }
        });
        return this.$q.all(allQueryPromise).then(function (responseList) {
            var result = [];
            _.each(responseList, function (response, index) {
                if (response.status === 'error') {
                    var error = tslib_1.__assign({ index: index }, response.error);
                    throw error;
                }
                // Keeping original start/end for transformers
                var transformerOptions = {
                    format: activeTargets[index].format,
                    step: queries[index].step,
                    legendFormat: activeTargets[index].legendFormat,
                    start: queries[index].start,
                    end: queries[index].end,
                    query: queries[index].expr,
                    responseListLength: responseList.length,
                    refId: activeTargets[index].refId,
                    valueWithRefId: activeTargets[index].valueWithRefId,
                };
                var series = _this.resultTransformer.transform(response, transformerOptions);
                result = tslib_1.__spread(result, series);
            });
            return { data: result };
        });
    };
    PrometheusDatasource.prototype.createQuery = function (target, options, start, end) {
        var query = {
            hinting: target.hinting,
            instant: target.instant,
        };
        var range = Math.ceil(end - start);
        // options.interval is the dynamically calculated interval
        var interval = kbn.interval_to_seconds(options.interval);
        // Minimum interval ("Min step"), if specified for the query or datasource. or same as interval otherwise
        var minInterval = kbn.interval_to_seconds(this.templateSrv.replace(target.interval, options.scopedVars) || options.interval);
        var intervalFactor = target.intervalFactor || 1;
        // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
        var adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
        var scopedVars = tslib_1.__assign({}, options.scopedVars, this.getRangeScopedVars());
        // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
        if (interval !== adjustedInterval) {
            interval = adjustedInterval;
            scopedVars = Object.assign({}, options.scopedVars, tslib_1.__assign({ __interval: { text: interval + 's', value: interval + 's' }, __interval_ms: { text: interval * 1000, value: interval * 1000 } }, this.getRangeScopedVars()));
        }
        query.step = interval;
        var expr = target.expr;
        // Apply adhoc filters
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        expr = adhocFilters.reduce(function (acc, filter) {
            var key = filter.key, operator = filter.operator;
            var value = filter.value;
            if (operator === '=~' || operator === '!~') {
                value = prometheusSpecialRegexEscape(value);
            }
            return addLabelToQuery(acc, key, value, operator);
        }, expr);
        // Only replace vars in expression after having (possibly) updated interval vars
        query.expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);
        query.requestId = options.panelId + target.refId;
        // Align query interval with step
        var adjusted = alignRange(start, end, query.step);
        query.start = adjusted.start;
        query.end = adjusted.end;
        return query;
    };
    PrometheusDatasource.prototype.adjustInterval = function (interval, minInterval, range, intervalFactor) {
        // Prometheus will drop queries that might return more than 11000 data points.
        // Calibrate interval if it is too small.
        if (interval !== 0 && range / intervalFactor / interval > 11000) {
            interval = Math.ceil(range / intervalFactor / 11000);
        }
        return Math.max(interval * intervalFactor, minInterval, 1);
    };
    PrometheusDatasource.prototype.performTimeSeriesQuery = function (query, start, end) {
        if (start > end) {
            throw { message: 'Invalid time range' };
        }
        var url = '/api/v1/query_range';
        var data = {
            query: query.expr,
            start: start,
            end: end,
            step: query.step,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(url, data, { requestId: query.requestId });
    };
    PrometheusDatasource.prototype.performInstantQuery = function (query, time) {
        var url = '/api/v1/query';
        var data = {
            query: query.expr,
            time: time,
        };
        if (this.queryTimeout) {
            data['timeout'] = this.queryTimeout;
        }
        return this._request(url, data, { requestId: query.requestId });
    };
    PrometheusDatasource.prototype.performSuggestQuery = function (query, cache) {
        var _this = this;
        if (cache === void 0) { cache = false; }
        var url = '/api/v1/label/__name__/values';
        if (cache && this.metricsNameCache && this.metricsNameCache.expire > Date.now()) {
            return this.$q.when(_.filter(this.metricsNameCache.data, function (metricName) {
                return metricName.indexOf(query) !== 1;
            }));
        }
        return this.metadataRequest(url).then(function (result) {
            _this.metricsNameCache = {
                data: result.data.data,
                expire: Date.now() + 60 * 1000,
            };
            return _.filter(result.data.data, function (metricName) {
                return metricName.indexOf(query) !== 1;
            });
        });
    };
    PrometheusDatasource.prototype.metricFindQuery = function (query) {
        if (!query) {
            return this.$q.when([]);
        }
        var scopedVars = tslib_1.__assign({ __interval: { text: this.interval, value: this.interval }, __interval_ms: { text: kbn.interval_to_ms(this.interval), value: kbn.interval_to_ms(this.interval) } }, this.getRangeScopedVars());
        var interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
        var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated, this.timeSrv);
        return metricFindQuery.process();
    };
    PrometheusDatasource.prototype.getRangeScopedVars = function () {
        var range = this.timeSrv.timeRange();
        var msRange = range.to.diff(range.from);
        var sRange = Math.round(msRange / 1000);
        var regularRange = kbn.secondsToHms(msRange / 1000);
        return {
            __range_ms: { text: msRange, value: msRange },
            __range_s: { text: sRange, value: sRange },
            __range: { text: regularRange, value: regularRange },
        };
    };
    PrometheusDatasource.prototype.annotationQuery = function (options) {
        var annotation = options.annotation;
        var expr = annotation.expr || '';
        var tagKeys = annotation.tagKeys || '';
        var titleFormat = annotation.titleFormat || '';
        var textFormat = annotation.textFormat || '';
        if (!expr) {
            return this.$q.when([]);
        }
        var step = annotation.step || '60s';
        var start = this.getPrometheusTime(options.range.from, false);
        var end = this.getPrometheusTime(options.range.to, true);
        var queryOptions = tslib_1.__assign({}, options, { interval: step });
        // Unsetting min interval for accurate event resolution
        var minStep = '1s';
        var query = this.createQuery({ expr: expr, interval: minStep }, queryOptions, start, end);
        var self = this;
        return this.performTimeSeriesQuery(query, query.start, query.end).then(function (results) {
            var eventList = [];
            tagKeys = tagKeys.split(',');
            _.each(results.data.data.result, function (series) {
                var e_2, _a;
                var tags = _.chain(series.metric)
                    .filter(function (v, k) {
                    return _.includes(tagKeys, k);
                })
                    .value();
                try {
                    for (var _b = tslib_1.__values(series.values), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var value = _c.value;
                        var valueIsTrue = value[1] === '1'; // e.g. ALERTS
                        if (valueIsTrue || annotation.useValueForTime) {
                            var event_1 = {
                                annotation: annotation,
                                title: self.resultTransformer.renderTemplate(titleFormat, series.metric),
                                tags: tags,
                                text: self.resultTransformer.renderTemplate(textFormat, series.metric),
                            };
                            if (annotation.useValueForTime) {
                                event_1['time'] = Math.floor(parseFloat(value[1]));
                            }
                            else {
                                event_1['time'] = Math.floor(parseFloat(value[0])) * 1000;
                            }
                            eventList.push(event_1);
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            });
            return eventList;
        });
    };
    PrometheusDatasource.prototype.getTagKeys = function (options) {
        var url = '/api/v1/labels';
        return this.metadataRequest(url).then(function (result) {
            return _.map(result.data.data, function (value) {
                return { text: value };
            });
        });
    };
    PrometheusDatasource.prototype.getTagValues = function (options) {
        var url = '/api/v1/label/' + options.key + '/values';
        return this.metadataRequest(url).then(function (result) {
            return _.map(result.data.data, function (value) {
                return { text: value };
            });
        });
    };
    PrometheusDatasource.prototype.testDatasource = function () {
        var now = new Date().getTime();
        return this.performInstantQuery({ expr: '1+1' }, now / 1000).then(function (response) {
            if (response.data.status === 'success') {
                return { status: 'success', message: 'Data source is working' };
            }
            else {
                return { status: 'error', message: response.error };
            }
        });
    };
    PrometheusDatasource.prototype.getExploreState = function (queries) {
        var _this = this;
        var state = { datasource: this.name };
        if (queries && queries.length > 0) {
            var expandedQueries = queries.map(function (query) { return (tslib_1.__assign({}, query, { expr: _this.templateSrv.replace(query.expr, {}, _this.interpolateQueryExpr), 
                // null out values we don't support in Explore yet
                legendFormat: null, step: null })); });
            state = tslib_1.__assign({}, state, { queries: expandedQueries });
        }
        return state;
    };
    PrometheusDatasource.prototype.getQueryHints = function (query, result) {
        return getQueryHints(query.expr || '', result, this);
    };
    PrometheusDatasource.prototype.loadRules = function () {
        var _this = this;
        this.metadataRequest('/api/v1/rules')
            .then(function (res) { return res.data || res.json(); })
            .then(function (body) {
            var groups = _.get(body, ['data', 'groups']);
            if (groups) {
                _this.ruleMappings = extractRuleMappingFromGroups(groups);
            }
        })
            .catch(function (e) {
            console.log('Rules API is experimental. Ignore next error.');
            console.error(e);
        });
    };
    PrometheusDatasource.prototype.modifyQuery = function (query, action) {
        var expression = query.expr || '';
        switch (action.type) {
            case 'ADD_FILTER': {
                expression = addLabelToQuery(expression, action.key, action.value);
                break;
            }
            case 'ADD_HISTOGRAM_QUANTILE': {
                expression = "histogram_quantile(0.95, sum(rate(" + expression + "[5m])) by (le))";
                break;
            }
            case 'ADD_RATE': {
                expression = "rate(" + expression + "[5m])";
                break;
            }
            case 'ADD_SUM': {
                expression = "sum(" + expression.trim() + ") by ($1)";
                break;
            }
            case 'EXPAND_RULES': {
                if (action.mapping) {
                    expression = expandRecordingRules(expression, action.mapping);
                }
                break;
            }
            default:
                break;
        }
        return tslib_1.__assign({}, query, { expr: expression });
    };
    PrometheusDatasource.prototype.getPrometheusTime = function (date, roundUp) {
        if (_.isString(date)) {
            date = dateMath.parse(date, roundUp);
        }
        return Math.ceil(date.valueOf() / 1000);
    };
    PrometheusDatasource.prototype.getTimeRange = function () {
        var range = this.timeSrv.timeRange();
        return {
            start: this.getPrometheusTime(range.from, false),
            end: this.getPrometheusTime(range.to, true),
        };
    };
    PrometheusDatasource.prototype.getOriginalMetricName = function (labelData) {
        return this.resultTransformer.getOriginalMetricName(labelData);
    };
    return PrometheusDatasource;
}());
export { PrometheusDatasource };
export function alignRange(start, end, step) {
    var alignedEnd = Math.ceil(end / step) * step;
    var alignedStart = Math.floor(start / step) * step;
    return {
        end: alignedEnd,
        start: alignedStart,
    };
}
export function extractRuleMappingFromGroups(groups) {
    return groups.reduce(function (mapping, group) {
        return group.rules
            .filter(function (rule) { return rule.type === 'recording'; })
            .reduce(function (acc, rule) {
            var _a;
            return (tslib_1.__assign({}, acc, (_a = {}, _a[rule.name] = rule.query, _a)));
        }, mapping);
    }, {});
}
export function prometheusRegularEscape(value) {
    if (typeof value === 'string') {
        return value.replace(/'/g, "\\\\'");
    }
    return value;
}
export function prometheusSpecialRegexEscape(value) {
    if (typeof value === 'string') {
        return prometheusRegularEscape(value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]+?.()]/g, '\\\\$&'));
    }
    return value;
}
//# sourceMappingURL=datasource.js.map