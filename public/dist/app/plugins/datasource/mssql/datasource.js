import _ from 'lodash';
import ResponseParser from './response_parser';
var MssqlDatasource = /** @class */ (function () {
    /** @ngInject */
    function MssqlDatasource(instanceSettings, backendSrv, $q, templateSrv, timeSrv) {
        this.backendSrv = backendSrv;
        this.$q = $q;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.name = instanceSettings.name;
        this.id = instanceSettings.id;
        this.responseParser = new ResponseParser(this.$q);
        this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
    }
    MssqlDatasource.prototype.interpolateVariable = function (value, variable) {
        if (typeof value === 'string') {
            if (variable.multi || variable.includeAll) {
                return "'" + value.replace(/'/g, "''") + "'";
            }
            else {
                return value;
            }
        }
        if (typeof value === 'number') {
            return value;
        }
        var quotedValues = _.map(value, function (val) {
            if (typeof value === 'number') {
                return value;
            }
            return "'" + val.replace(/'/g, "''") + "'";
        });
        return quotedValues.join(',');
    };
    MssqlDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (item) {
            return item.hide !== true;
        }).map(function (item) {
            return {
                refId: item.refId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                datasourceId: _this.id,
                rawSql: _this.templateSrv.replace(item.rawSql, options.scopedVars, _this.interpolateVariable),
                format: item.format,
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
    MssqlDatasource.prototype.annotationQuery = function (options) {
        var _this = this;
        if (!options.annotation.rawQuery) {
            return this.$q.reject({ message: 'Query missing in annotation definition' });
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
    MssqlDatasource.prototype.metricFindQuery = function (query, optionalOptions) {
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
    MssqlDatasource.prototype.testDatasource = function () {
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
    return MssqlDatasource;
}());
export { MssqlDatasource };
//# sourceMappingURL=datasource.js.map