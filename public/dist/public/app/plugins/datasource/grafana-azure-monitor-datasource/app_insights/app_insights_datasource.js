import { __extends } from "tslib";
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { isString } from 'lodash';
import TimegrainConverter from '../time_grain_converter';
import { AzureQueryType } from '../types';
import { routeNames } from '../utils/common';
import ResponseParser from './response_parser';
var AppInsightsDatasource = /** @class */ (function (_super) {
    __extends(AppInsightsDatasource, _super);
    function AppInsightsDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.version = 'beta';
        _this.logAnalyticsColumns = {};
        _this.applicationId = instanceSettings.jsonData.appInsightsAppId || '';
        _this.resourcePath = routeNames.appInsights + "/" + _this.version + "/apps/" + _this.applicationId;
        return _this;
    }
    AppInsightsDatasource.prototype.isConfigured = function () {
        return !!this.applicationId && this.applicationId.length > 0;
    };
    AppInsightsDatasource.prototype.createRawQueryRequest = function (item, options, target) {
        if (item.xaxis && !item.timeColumn) {
            item.timeColumn = item.xaxis;
        }
        if (item.yaxis && !item.valueColumn) {
            item.valueColumn = item.yaxis;
        }
        if (item.spliton && !item.segmentColumn) {
            item.segmentColumn = item.spliton;
        }
        return {
            type: 'timeSeriesQuery',
            raw: false,
            appInsights: {
                rawQuery: true,
                rawQueryString: getTemplateSrv().replace(item.rawQueryString, options.scopedVars),
                timeColumn: item.timeColumn,
                valueColumn: item.valueColumn,
                segmentColumn: item.segmentColumn,
            },
        };
    };
    AppInsightsDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var item = target.appInsights;
        if (!item) {
            return target;
        }
        var old = item;
        // fix for timeGrainUnit which is a deprecated/removed field name
        if (old.timeGrainCount) {
            item.timeGrain = TimegrainConverter.createISO8601Duration(old.timeGrainCount, item.timeGrainUnit);
        }
        else if (item.timeGrain && item.timeGrainUnit && item.timeGrain !== 'auto') {
            item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
        }
        // migration for non-standard names
        if (old.groupBy && !item.dimension) {
            item.dimension = [old.groupBy];
        }
        if (old.filter && !item.dimensionFilter) {
            item.dimensionFilter = old.filter;
        }
        // Migrate single dimension string to array
        if (isString(item.dimension)) {
            if (item.dimension === 'None') {
                item.dimension = [];
            }
            else {
                item.dimension = [item.dimension];
            }
        }
        if (!item.dimension) {
            item.dimension = [];
        }
        var templateSrv = getTemplateSrv();
        return {
            refId: target.refId,
            queryType: AzureQueryType.ApplicationInsights,
            appInsights: {
                timeGrain: templateSrv.replace((item.timeGrain || '').toString(), scopedVars),
                metricName: templateSrv.replace(item.metricName, scopedVars),
                aggregation: templateSrv.replace(item.aggregation, scopedVars),
                dimension: item.dimension.map(function (d) { return templateSrv.replace(d, scopedVars); }),
                dimensionFilter: templateSrv.replace(item.dimensionFilter, scopedVars),
                alias: item.alias,
            },
        };
    };
    /**
     * This is named differently than DataSourceApi.metricFindQuery
     * because it's not exposed to Grafana like the main AzureMonitorDataSource.
     * And some of the azure internal data sources return null in this function, which the
     * external interface does not support
     */
    AppInsightsDatasource.prototype.metricFindQueryInternal = function (query) {
        var appInsightsMetricNameQuery = query.match(/^AppInsightsMetricNames\(\)/i);
        if (appInsightsMetricNameQuery) {
            return this.getMetricNames();
        }
        var appInsightsGroupByQuery = query.match(/^AppInsightsGroupBys\(([^\)]+?)(,\s?([^,]+?))?\)/i);
        if (appInsightsGroupByQuery) {
            var metricName = appInsightsGroupByQuery[1];
            return this.getGroupBys(getTemplateSrv().replace(metricName));
        }
        return null;
    };
    AppInsightsDatasource.prototype.testDatasource = function () {
        var path = this.resourcePath + "/metrics/metadata";
        return this.getResource(path)
            .then(function (response) {
            return {
                status: 'success',
                message: 'Successfully queried the Application Insights service.',
                title: 'Success',
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
    AppInsightsDatasource.prototype.getMetricNames = function () {
        var path = this.resourcePath + "/metrics/metadata";
        return this.getResource(path).then(ResponseParser.parseMetricNames);
    };
    AppInsightsDatasource.prototype.getMetricMetadata = function (metricName) {
        var path = this.resourcePath + "/metrics/metadata";
        return this.getResource(path).then(function (result) {
            return new ResponseParser(result).parseMetadata(metricName);
        });
    };
    AppInsightsDatasource.prototype.getGroupBys = function (metricName) {
        return this.getMetricMetadata(metricName).then(function (result) {
            return new ResponseParser(result).parseGroupBys();
        });
    };
    AppInsightsDatasource.prototype.getQuerySchema = function () {
        var path = this.resourcePath + "/query/schema";
        return this.getResource(path).then(function (result) {
            var schema = new ResponseParser(result).parseQuerySchema();
            // console.log(schema);
            return schema;
        });
    };
    return AppInsightsDatasource;
}(DataSourceWithBackend));
export default AppInsightsDatasource;
//# sourceMappingURL=app_insights_datasource.js.map