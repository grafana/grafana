import * as tslib_1 from "tslib";
import { stackdriverUnitMappings } from './constants';
import appEvents from 'app/core/app_events';
import _ from 'lodash';
import StackdriverMetricFindQuery from './StackdriverMetricFindQuery';
var StackdriverDatasource = /** @class */ (function () {
    /** @ngInject */
    function StackdriverDatasource(instanceSettings, backendSrv, templateSrv, timeSrv) {
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.baseUrl = "/stackdriver/";
        this.url = instanceSettings.url;
        this.id = instanceSettings.id;
        this.projectName = instanceSettings.jsonData.defaultProject || '';
        this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
        this.metricTypes = [];
    }
    StackdriverDatasource.prototype.getTimeSeries = function (options) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var queries, data;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queries = options.targets
                            .filter(function (target) {
                            return !target.hide && target.metricType;
                        })
                            .map(function (t) {
                            return {
                                refId: t.refId,
                                intervalMs: options.intervalMs,
                                datasourceId: _this.id,
                                metricType: _this.templateSrv.replace(t.metricType, options.scopedVars || {}),
                                crossSeriesReducer: _this.templateSrv.replace(t.crossSeriesReducer || 'REDUCE_MEAN', options.scopedVars || {}),
                                perSeriesAligner: _this.templateSrv.replace(t.perSeriesAligner, options.scopedVars || {}),
                                alignmentPeriod: _this.templateSrv.replace(t.alignmentPeriod, options.scopedVars || {}),
                                groupBys: _this.interpolateGroupBys(t.groupBys, options.scopedVars),
                                view: t.view || 'FULL',
                                filters: _this.interpolateFilters(t.filters, options.scopedVars),
                                aliasBy: _this.templateSrv.replace(t.aliasBy, options.scopedVars || {}),
                                type: 'timeSeriesQuery',
                            };
                        });
                        if (!(queries.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.backendSrv.datasourceRequest({
                                url: '/api/tsdb/query',
                                method: 'POST',
                                data: {
                                    from: options.range.from.valueOf().toString(),
                                    to: options.range.to.valueOf().toString(),
                                    queries: queries,
                                },
                            })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data];
                    case 2: return [2 /*return*/, { results: [] }];
                }
            });
        });
    };
    StackdriverDatasource.prototype.interpolateFilters = function (filters, scopedVars) {
        var _this = this;
        return (filters || []).map(function (f) {
            return _this.templateSrv.replace(f, scopedVars || {}, 'regex');
        });
    };
    StackdriverDatasource.prototype.getLabels = function (metricType, refId) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var response;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTimeSeries({
                            targets: [
                                {
                                    refId: refId,
                                    datasourceId: this.id,
                                    metricType: this.templateSrv.replace(metricType),
                                    crossSeriesReducer: 'REDUCE_NONE',
                                    view: 'HEADERS',
                                },
                            ],
                            range: this.timeSrv.timeRange(),
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.results[refId]];
                }
            });
        });
    };
    StackdriverDatasource.prototype.interpolateGroupBys = function (groupBys, scopedVars) {
        var _this = this;
        var interpolatedGroupBys = [];
        (groupBys || []).forEach(function (gb) {
            var interpolated = _this.templateSrv.replace(gb, scopedVars || {}, 'csv').split(',');
            if (Array.isArray(interpolated)) {
                interpolatedGroupBys = interpolatedGroupBys.concat(interpolated);
            }
            else {
                interpolatedGroupBys.push(interpolated);
            }
        });
        return interpolatedGroupBys;
    };
    StackdriverDatasource.prototype.resolvePanelUnitFromTargets = function (targets) {
        var unit;
        if (targets.length > 0 && targets.every(function (t) { return t.unit === targets[0].unit; })) {
            if (stackdriverUnitMappings.hasOwnProperty(targets[0].unit)) {
                unit = stackdriverUnitMappings[targets[0].unit];
            }
        }
        return unit;
    };
    StackdriverDatasource.prototype.query = function (options) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result, data;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = [];
                        return [4 /*yield*/, this.getTimeSeries(options)];
                    case 1:
                        data = _a.sent();
                        if (data.results) {
                            Object['values'](data.results).forEach(function (queryRes) {
                                if (!queryRes.series) {
                                    return;
                                }
                                var unit = _this.resolvePanelUnitFromTargets(options.targets);
                                queryRes.series.forEach(function (series) {
                                    var timeSerie = {
                                        target: series.name,
                                        datapoints: series.points,
                                        refId: queryRes.refId,
                                        meta: queryRes.meta,
                                    };
                                    if (unit) {
                                        timeSerie = tslib_1.__assign({}, timeSerie, { unit: unit });
                                    }
                                    result.push(timeSerie);
                                });
                            });
                            return [2 /*return*/, { data: result }];
                        }
                        else {
                            return [2 /*return*/, { data: [] }];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    StackdriverDatasource.prototype.annotationQuery = function (options) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var annotation, queries, data, results;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        annotation = options.annotation;
                        queries = [
                            {
                                refId: 'annotationQuery',
                                datasourceId: this.id,
                                metricType: this.templateSrv.replace(annotation.target.metricType, options.scopedVars || {}),
                                crossSeriesReducer: 'REDUCE_NONE',
                                perSeriesAligner: 'ALIGN_NONE',
                                title: this.templateSrv.replace(annotation.target.title, options.scopedVars || {}),
                                text: this.templateSrv.replace(annotation.target.text, options.scopedVars || {}),
                                tags: this.templateSrv.replace(annotation.target.tags, options.scopedVars || {}),
                                view: 'FULL',
                                filters: (annotation.target.filters || []).map(function (f) {
                                    return _this.templateSrv.replace(f, options.scopedVars || {});
                                }),
                                type: 'annotationQuery',
                            },
                        ];
                        return [4 /*yield*/, this.backendSrv.datasourceRequest({
                                url: '/api/tsdb/query',
                                method: 'POST',
                                data: {
                                    from: options.range.from.valueOf().toString(),
                                    to: options.range.to.valueOf().toString(),
                                    queries: queries,
                                },
                            })];
                    case 1:
                        data = (_a.sent()).data;
                        results = data.results['annotationQuery'].tables[0].rows.map(function (v) {
                            return {
                                annotation: annotation,
                                time: Date.parse(v[0]),
                                title: v[1],
                                tags: [],
                                text: v[3],
                            };
                        });
                        return [2 /*return*/, results];
                }
            });
        });
    };
    StackdriverDatasource.prototype.metricFindQuery = function (query) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var stackdriverMetricFindQuery;
            return tslib_1.__generator(this, function (_a) {
                stackdriverMetricFindQuery = new StackdriverMetricFindQuery(this);
                return [2 /*return*/, stackdriverMetricFindQuery.execute(query)];
            });
        });
    };
    StackdriverDatasource.prototype.testDatasource = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var status, message, defaultErrorMessage, projectName, path, response, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        defaultErrorMessage = 'Cannot connect to Stackdriver API';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        return [4 /*yield*/, this.getDefaultProject()];
                    case 2:
                        projectName = _a.sent();
                        path = "v3/projects/" + projectName + "/metricDescriptors";
                        return [4 /*yield*/, this.doRequest("" + this.baseUrl + path)];
                    case 3:
                        response = _a.sent();
                        if (response.status === 200) {
                            status = 'success';
                            message = 'Successfully queried the Stackdriver API.';
                        }
                        else {
                            status = 'error';
                            message = response.statusText ? response.statusText : defaultErrorMessage;
                        }
                        return [3 /*break*/, 6];
                    case 4:
                        error_1 = _a.sent();
                        status = 'error';
                        if (_.isString(error_1)) {
                            message = error_1;
                        }
                        else {
                            message = 'Stackdriver: ';
                            message += error_1.statusText ? error_1.statusText : defaultErrorMessage;
                            if (error_1.data && error_1.data.error && error_1.data.error.code) {
                                message += ': ' + error_1.data.error.code + '. ' + error_1.data.error.message;
                            }
                        }
                        return [3 /*break*/, 6];
                    case 5: return [2 /*return*/, {
                            status: status,
                            message: message,
                        }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    StackdriverDatasource.prototype.formatStackdriverError = function (error) {
        var message = 'Stackdriver: ';
        message += error.statusText ? error.statusText + ': ' : '';
        if (error.data && error.data.error) {
            try {
                var res = JSON.parse(error.data.error);
                message += res.error.code + '. ' + res.error.message;
            }
            catch (err) {
                message += error.data.error;
            }
        }
        else {
            message += 'Cannot connect to Stackdriver API';
        }
        return message;
    };
    StackdriverDatasource.prototype.getDefaultProject = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var data, error_2;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!(this.authenticationType === 'gce' || !this.projectName)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.backendSrv.datasourceRequest({
                                url: '/api/tsdb/query',
                                method: 'POST',
                                data: {
                                    queries: [
                                        {
                                            refId: 'ensureDefaultProjectQuery',
                                            type: 'ensureDefaultProjectQuery',
                                            datasourceId: this.id,
                                        },
                                    ],
                                },
                            })];
                    case 1:
                        data = (_a.sent()).data;
                        this.projectName = data.results.ensureDefaultProjectQuery.meta.defaultProject;
                        return [2 /*return*/, this.projectName];
                    case 2: return [2 /*return*/, this.projectName];
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        throw this.formatStackdriverError(error_2);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    StackdriverDatasource.prototype.getMetricTypes = function (projectName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var metricsApiPath, data, error_3;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!(this.metricTypes.length === 0)) return [3 /*break*/, 2];
                        metricsApiPath = "v3/projects/" + projectName + "/metricDescriptors";
                        return [4 /*yield*/, this.doRequest("" + this.baseUrl + metricsApiPath)];
                    case 1:
                        data = (_a.sent()).data;
                        this.metricTypes = data.metricDescriptors.map(function (m) {
                            var _a = tslib_1.__read(m.type.split('/'), 1), service = _a[0];
                            var _b = tslib_1.__read(service.split('.'), 1), serviceShortName = _b[0];
                            m.service = service;
                            m.serviceShortName = serviceShortName;
                            m.displayName = m.displayName || m.type;
                            return m;
                        });
                        _a.label = 2;
                    case 2: return [2 /*return*/, this.metricTypes];
                    case 3:
                        error_3 = _a.sent();
                        appEvents.emit('ds-request-error', this.formatStackdriverError(error_3));
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    StackdriverDatasource.prototype.doRequest = function (url, maxRetries) {
        if (maxRetries === void 0) { maxRetries = 1; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.backendSrv
                        .datasourceRequest({
                        url: this.url + url,
                        method: 'GET',
                    })
                        .catch(function (error) {
                        if (maxRetries > 0) {
                            return _this.doRequest(url, maxRetries - 1);
                        }
                        throw error;
                    })];
            });
        });
    };
    return StackdriverDatasource;
}());
export default StackdriverDatasource;
//# sourceMappingURL=datasource.js.map