import { __assign, __awaiter, __extends, __generator } from "tslib";
import { map as _map } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map, mapTo } from 'rxjs/operators';
import { DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import MySQLQueryModel from 'app/plugins/datasource/mysql/mysql_query_model';
import ResponseParser from './response_parser';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';
var MysqlDatasource = /** @class */ (function (_super) {
    __extends(MysqlDatasource, _super);
    function MysqlDatasource(instanceSettings, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.interpolateVariable = function (value, variable) {
            if (typeof value === 'string') {
                if (variable.multi || variable.includeAll) {
                    var result = _this.queryModel.quoteLiteral(value);
                    return result;
                }
                else {
                    return value;
                }
            }
            if (typeof value === 'number') {
                return value;
            }
            var quotedValues = _map(value, function (v) {
                return _this.queryModel.quoteLiteral(v);
            });
            return quotedValues.join(',');
        };
        _this.name = instanceSettings.name;
        _this.id = instanceSettings.id;
        _this.responseParser = new ResponseParser();
        _this.queryModel = new MySQLQueryModel({});
        var settingsData = instanceSettings.jsonData || {};
        _this.interval = settingsData.timeInterval || '1m';
        return _this;
    }
    MysqlDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        var expandedQueries = queries;
        if (queries && queries.length > 0) {
            expandedQueries = queries.map(function (query) {
                var expandedQuery = __assign(__assign({}, query), { datasource: _this.getRef(), rawSql: _this.templateSrv.replace(query.rawSql, scopedVars, _this.interpolateVariable), rawQuery: true });
                return expandedQuery;
            });
        }
        return expandedQueries;
    };
    MysqlDatasource.prototype.filterQuery = function (query) {
        return !query.hide;
    };
    MysqlDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var queryModel = new MySQLQueryModel(target, this.templateSrv, scopedVars);
        return {
            refId: target.refId,
            datasourceId: this.id,
            rawSql: queryModel.render(this.interpolateVariable),
            format: target.format,
        };
    };
    MysqlDatasource.prototype.annotationQuery = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            var _this = this;
            return __generator(this, function (_a) {
                if (!options.annotation.rawQuery) {
                    return [2 /*return*/, Promise.reject({
                            message: 'Query missing in annotation definition',
                        })];
                }
                query = {
                    refId: options.annotation.name,
                    datasourceId: this.id,
                    rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
                    format: 'table',
                };
                return [2 /*return*/, lastValueFrom(getBackendSrv()
                        .fetch({
                        url: '/api/ds/query',
                        method: 'POST',
                        data: {
                            from: options.range.from.valueOf().toString(),
                            to: options.range.to.valueOf().toString(),
                            queries: [query],
                        },
                        requestId: options.annotation.name,
                    })
                        .pipe(map(function (res) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.responseParser.transformAnnotationResponse(options, res.data)];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); })))];
            });
        });
    };
    MysqlDatasource.prototype.metricFindQuery = function (query, optionalOptions) {
        var _this = this;
        var refId = 'tempvar';
        if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
            refId = optionalOptions.variable.name;
        }
        var rawSql = this.templateSrv.replace(query, getSearchFilterScopedVar({ query: query, wildcardChar: '%', options: optionalOptions }), this.interpolateVariable);
        var interpolatedQuery = {
            refId: refId,
            datasourceId: this.id,
            rawSql: rawSql,
            format: 'table',
        };
        var range = this.timeSrv.timeRange();
        return lastValueFrom(getBackendSrv()
            .fetch({
            url: '/api/ds/query',
            method: 'POST',
            data: {
                from: range.from.valueOf().toString(),
                to: range.to.valueOf().toString(),
                queries: [interpolatedQuery],
            },
            requestId: refId,
        })
            .pipe(map(function (rsp) {
            return _this.responseParser.transformMetricFindResponse(rsp);
        }), catchError(function (err) {
            return of([]);
        })));
    };
    MysqlDatasource.prototype.testDatasource = function () {
        return lastValueFrom(getBackendSrv()
            .fetch({
            url: '/api/ds/query',
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
            .pipe(mapTo({ status: 'success', message: 'Database Connection OK' }), catchError(function (err) {
            return of(toTestingStatus(err));
        })));
    };
    MysqlDatasource.prototype.targetContainsTemplate = function (target) {
        var rawSql = '';
        if (target.rawQuery) {
            rawSql = target.rawSql;
        }
        else {
            var query = new MySQLQueryModel(target);
            rawSql = query.buildQuery();
        }
        rawSql = rawSql.replace('$__', '');
        return this.templateSrv.variableExists(rawSql);
    };
    return MysqlDatasource;
}(DataSourceWithBackend));
export { MysqlDatasource };
//# sourceMappingURL=datasource.js.map