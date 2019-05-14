import _ from 'lodash';
import ResponseParser from './response_parser';
import MysqlQuery from 'app/plugins/datasource/mysql/mysql_query';
var MysqlDatasource = /** @class */ (function () {
    /** @ngInject */
    function MysqlDatasource(instanceSettings, backendSrv, $q, templateSrv, timeSrv) {
        var _this = this;
        this.backendSrv = backendSrv;
        this.$q = $q;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.interpolateVariable = function (value, variable) {
            if (typeof value === 'string') {
                if (variable.multi || variable.includeAll) {
                    return _this.queryModel.quoteLiteral(value);
                }
                else {
                    return value;
                }
            }
            if (typeof value === 'number') {
                return value;
            }
            var quotedValues = _.map(value, function (v) {
                return _this.queryModel.quoteLiteral(v);
            });
            return quotedValues.join(',');
        };
        this.name = instanceSettings.name;
        this.id = instanceSettings.id;
        this.responseParser = new ResponseParser(this.$q);
        this.queryModel = new MysqlQuery({});
        this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
    }
    MysqlDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (target) {
            return target.hide !== true;
        }).map(function (target) {
            var queryModel = new MysqlQuery(target, _this.templateSrv, options.scopedVars);
            return {
                refId: target.refId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                datasourceId: _this.id,
                rawSql: queryModel.render(_this.interpolateVariable),
                format: target.format,
            };
        });
        if (queries.length === 0) {
            return this.$q.when({ data: [] });
        }
        return this.backendSrv
            .datasourceRequest({
            url: '/api/tsdb/query',
            method: 'POST',
            data: {
                from: options.range.from.valueOf().toString(),
                to: options.range.to.valueOf().toString(),
                queries: queries,
            },
        })
            .then(this.responseParser.processQueryResult);
    };
    MysqlDatasource.prototype.annotationQuery = function (options) {
        var _this = this;
        if (!options.annotation.rawQuery) {
            return this.$q.reject({
                message: 'Query missing in annotation definition',
            });
        }
        var query = {
            refId: options.annotation.name,
            datasourceId: this.id,
            rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
            format: 'table',
        };
        return this.backendSrv
            .datasourceRequest({
            url: '/api/tsdb/query',
            method: 'POST',
            data: {
                from: options.range.from.valueOf().toString(),
                to: options.range.to.valueOf().toString(),
                queries: [query],
            },
        })
            .then(function (data) { return _this.responseParser.transformAnnotationResponse(options, data); });
    };
    MysqlDatasource.prototype.metricFindQuery = function (query, optionalOptions) {
        var _this = this;
        var refId = 'tempvar';
        if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
            refId = optionalOptions.variable.name;
        }
        var interpolatedQuery = {
            refId: refId,
            datasourceId: this.id,
            rawSql: this.templateSrv.replace(query, {}, this.interpolateVariable),
            format: 'table',
        };
        var range = this.timeSrv.timeRange();
        var data = {
            queries: [interpolatedQuery],
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
        };
        if (optionalOptions && optionalOptions.range && optionalOptions.range.from) {
            data['from'] = optionalOptions.range.from.valueOf().toString();
        }
        if (optionalOptions && optionalOptions.range && optionalOptions.range.to) {
            data['to'] = optionalOptions.range.to.valueOf().toString();
        }
        return this.backendSrv
            .datasourceRequest({
            url: '/api/tsdb/query',
            method: 'POST',
            data: data,
        })
            .then(function (data) { return _this.responseParser.parseMetricFindQueryResult(refId, data); });
    };
    MysqlDatasource.prototype.testDatasource = function () {
        return this.backendSrv
            .datasourceRequest({
            url: '/api/tsdb/query',
            method: 'POST',
            data: {
                from: '5m',
                to: 'now',
                queries: [
                    {
                        refId: 'A',
                        intervalMs: 1,
                        maxDataPoints: 1,
                        datasourceId: this.id,
                        rawSql: 'SELECT 1',
                        format: 'table',
                    },
                ],
            },
        })
            .then(function (res) {
            return { status: 'success', message: 'Database Connection OK' };
        })
            .catch(function (err) {
            console.log(err);
            if (err.data && err.data.message) {
                return { status: 'error', message: err.data.message };
            }
            else {
                return { status: 'error', message: err.status };
            }
        });
    };
    return MysqlDatasource;
}());
export { MysqlDatasource };
//# sourceMappingURL=datasource.js.map