import _ from 'lodash';
import ResponseParser from './response_parser';
import PostgresQuery from 'app/plugins/datasource/postgres/postgres_query';
var PostgresDatasource = /** @class */ (function () {
    /** @ngInject */
    function PostgresDatasource(instanceSettings, backendSrv, $q, templateSrv, timeSrv) {
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
        this.jsonData = instanceSettings.jsonData;
        this.responseParser = new ResponseParser(this.$q);
        this.queryModel = new PostgresQuery({});
        this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
    }
    PostgresDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (target) {
            return target.hide !== true;
        }).map(function (target) {
            var queryModel = new PostgresQuery(target, _this.templateSrv, options.scopedVars);
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
    PostgresDatasource.prototype.annotationQuery = function (options) {
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
    PostgresDatasource.prototype.metricFindQuery = function (query, optionalOptions) {
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
        return this.backendSrv
            .datasourceRequest({
            url: '/api/tsdb/query',
            method: 'POST',
            data: data,
        })
            .then(function (data) { return _this.responseParser.parseMetricFindQueryResult(refId, data); });
    };
    PostgresDatasource.prototype.getVersion = function () {
        return this.metricFindQuery("SELECT current_setting('server_version_num')::int/100", {});
    };
    PostgresDatasource.prototype.getTimescaleDBVersion = function () {
        return this.metricFindQuery("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'", {});
    };
    PostgresDatasource.prototype.testDatasource = function () {
        return this.metricFindQuery('SELECT 1', {})
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
    return PostgresDatasource;
}());
export { PostgresDatasource };
//# sourceMappingURL=datasource.js.map