import _ from 'lodash';
import AppInsightsQuerystringBuilder from './app_insights_querystring_builder';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import ResponseParser from './response_parser';
var AppInsightsDatasource = /** @class */ (function () {
    /** @ngInject */
    function AppInsightsDatasource(instanceSettings, backendSrv, templateSrv, $q) {
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.$q = $q;
        this.version = 'beta';
        this.logAnalyticsColumns = {};
        this.id = instanceSettings.id;
        this.applicationId = instanceSettings.jsonData.appInsightsAppId;
        this.baseUrl = "/appinsights/" + this.version + "/apps/" + this.applicationId;
        this.url = instanceSettings.url;
    }
    AppInsightsDatasource.prototype.isConfigured = function () {
        return !!this.applicationId && this.applicationId.length > 0;
    };
    AppInsightsDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (item) {
            return item.hide !== true;
        }).map(function (target) {
            var item = target.appInsights;
            if (item.rawQuery) {
                var querystringBuilder = new LogAnalyticsQuerystringBuilder(_this.templateSrv.replace(item.rawQueryString, options.scopedVars), options, 'timestamp');
                var generated = querystringBuilder.generate();
                var url = _this.baseUrl + "/query?" + generated.uriString;
                return {
                    refId: target.refId,
                    intervalMs: options.intervalMs,
                    maxDataPoints: options.maxDataPoints,
                    datasourceId: _this.id,
                    url: url,
                    format: options.format,
                    alias: item.alias,
                    query: generated.rawQuery,
                    xaxis: item.xaxis,
                    yaxis: item.yaxis,
                    spliton: item.spliton,
                    raw: true,
                };
            }
            else {
                var querystringBuilder = new AppInsightsQuerystringBuilder(options.range.from, options.range.to, options.interval);
                if (item.groupBy !== 'none') {
                    querystringBuilder.setGroupBy(_this.templateSrv.replace(item.groupBy, options.scopedVars));
                }
                querystringBuilder.setAggregation(item.aggregation);
                querystringBuilder.setInterval(item.timeGrainType, _this.templateSrv.replace(item.timeGrain, options.scopedVars), item.timeGrainUnit);
                querystringBuilder.setFilter(_this.templateSrv.replace(item.filter || ''));
                var url = _this.baseUrl + "/metrics/" + _this.templateSrv.replace(encodeURI(item.metricName), options.scopedVars) + "?" + querystringBuilder.generate();
                return {
                    refId: target.refId,
                    intervalMs: options.intervalMs,
                    maxDataPoints: options.maxDataPoints,
                    datasourceId: _this.id,
                    url: url,
                    format: options.format,
                    alias: item.alias,
                    xaxis: '',
                    yaxis: '',
                    spliton: '',
                    raw: false,
                };
            }
        });
        if (!queries || queries.length === 0) {
            return;
        }
        var promises = this.doQueries(queries);
        return this.$q
            .all(promises)
            .then(function (results) {
            return new ResponseParser(results).parseQueryResult();
        })
            .then(function (results) {
            var flattened = [];
            for (var i = 0; i < results.length; i++) {
                if (results[i].columnsForDropdown) {
                    _this.logAnalyticsColumns[results[i].refId] = results[i].columnsForDropdown;
                }
                flattened.push(results[i]);
            }
            return flattened;
        });
    };
    AppInsightsDatasource.prototype.doQueries = function (queries) {
        var _this = this;
        return _.map(queries, function (query) {
            return _this.doRequest(query.url)
                .then(function (result) {
                return {
                    result: result,
                    query: query,
                };
            })
                .catch(function (err) {
                throw {
                    error: err,
                    query: query,
                };
            });
        });
    };
    AppInsightsDatasource.prototype.annotationQuery = function (options) { };
    AppInsightsDatasource.prototype.metricFindQuery = function (query) {
        var appInsightsMetricNameQuery = query.match(/^AppInsightsMetricNames\(\)/i);
        if (appInsightsMetricNameQuery) {
            return this.getMetricNames();
        }
        var appInsightsGroupByQuery = query.match(/^AppInsightsGroupBys\(([^\)]+?)(,\s?([^,]+?))?\)/i);
        if (appInsightsGroupByQuery) {
            var metricName = appInsightsGroupByQuery[1];
            return this.getGroupBys(this.templateSrv.replace(metricName));
        }
        return undefined;
    };
    AppInsightsDatasource.prototype.testDatasource = function () {
        var url = this.baseUrl + "/metrics/metadata";
        return this.doRequest(url)
            .then(function (response) {
            if (response.status === 200) {
                return {
                    status: 'success',
                    message: 'Successfully queried the Application Insights service.',
                    title: 'Success',
                };
            }
            return {
                status: 'error',
                message: 'Returned http status code ' + response.status,
            };
        })
            .catch(function (error) {
            var message = 'Application Insights: ';
            message += error.statusText ? error.statusText + ': ' : '';
            if (error.data && error.data.error && error.data.error.code === 'PathNotFoundError') {
                message += 'Invalid Application Id for Application Insights service.';
            }
            else if (error.data && error.data.error) {
                message += error.data.error.code + '. ' + error.data.error.message;
            }
            else {
                message += 'Cannot connect to Application Insights REST API.';
            }
            return {
                status: 'error',
                message: message,
            };
        });
    };
    AppInsightsDatasource.prototype.doRequest = function (url, maxRetries) {
        var _this = this;
        if (maxRetries === void 0) { maxRetries = 1; }
        return this.backendSrv
            .datasourceRequest({
            url: this.url + url,
            method: 'GET',
        })
            .catch(function (error) {
            if (maxRetries > 0) {
                return _this.doRequest(url, maxRetries - 1);
            }
            throw error;
        });
    };
    AppInsightsDatasource.prototype.getMetricNames = function () {
        var url = this.baseUrl + "/metrics/metadata";
        return this.doRequest(url).then(ResponseParser.parseMetricNames);
    };
    AppInsightsDatasource.prototype.getMetricMetadata = function (metricName) {
        var url = this.baseUrl + "/metrics/metadata";
        return this.doRequest(url).then(function (result) {
            return new ResponseParser(result).parseMetadata(metricName);
        });
    };
    AppInsightsDatasource.prototype.getGroupBys = function (metricName) {
        return this.getMetricMetadata(metricName).then(function (result) {
            return new ResponseParser(result).parseGroupBys();
        });
    };
    AppInsightsDatasource.prototype.getQuerySchema = function () {
        var url = this.baseUrl + "/query/schema";
        return this.doRequest(url).then(function (result) {
            var schema = new ResponseParser(result).parseQuerySchema();
            // console.log(schema);
            return schema;
        });
    };
    return AppInsightsDatasource;
}());
export default AppInsightsDatasource;
//# sourceMappingURL=app_insights_datasource.js.map