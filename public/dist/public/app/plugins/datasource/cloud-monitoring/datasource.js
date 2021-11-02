import { __assign, __awaiter, __extends, __generator, __read, __rest, __spreadArray } from "tslib";
import { chunk, flatten, isString } from 'lodash';
import { from, lastValueFrom, of, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { DataSourceWithBackend, toDataQueryResponse } from '@grafana/runtime';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { EditorMode, QueryType } from './types';
import API from './api';
import { CloudMonitoringVariableSupport } from './variables';
var CloudMonitoringDatasource = /** @class */ (function (_super) {
    __extends(CloudMonitoringDatasource, _super);
    function CloudMonitoringDatasource(instanceSettings, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
        _this.api = new API(instanceSettings.url + "/cloudmonitoring/v3/projects/");
        _this.variables = new CloudMonitoringVariableSupport(_this);
        _this.intervalMs = 0;
        return _this;
    }
    CloudMonitoringDatasource.prototype.getVariables = function () {
        return this.templateSrv.getVariables().map(function (v) { return "$" + v.name; });
    };
    CloudMonitoringDatasource.prototype.query = function (request) {
        var _this = this;
        request.targets = request.targets.map(function (t) { return (__assign(__assign({}, _this.migrateQuery(t)), { intervalMs: request.intervalMs })); });
        return _super.prototype.query.call(this, request);
    };
    CloudMonitoringDatasource.prototype.annotationQuery = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var annotation, queries;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.ensureGCEDefaultProject()];
                    case 1:
                        _a.sent();
                        annotation = options.annotation;
                        queries = [
                            {
                                refId: 'annotationQuery',
                                type: 'annotationQuery',
                                datasourceId: this.id,
                                view: 'FULL',
                                crossSeriesReducer: 'REDUCE_NONE',
                                perSeriesAligner: 'ALIGN_NONE',
                                metricType: this.templateSrv.replace(annotation.target.metricType, options.scopedVars || {}),
                                title: this.templateSrv.replace(annotation.target.title, options.scopedVars || {}),
                                text: this.templateSrv.replace(annotation.target.text, options.scopedVars || {}),
                                tags: (annotation.target.tags || []).map(function (t) { return _this.templateSrv.replace(t, options.scopedVars || {}); }),
                                projectName: this.templateSrv.replace(annotation.target.projectName ? annotation.target.projectName : this.getDefaultProject(), options.scopedVars || {}),
                                filters: this.interpolateFilters(annotation.target.filters || [], options.scopedVars),
                            },
                        ];
                        return [2 /*return*/, lastValueFrom(this.api
                                .post({
                                from: options.range.from.valueOf().toString(),
                                to: options.range.to.valueOf().toString(),
                                queries: queries,
                            })
                                .pipe(map(function (_a) {
                                var data = _a.data;
                                var dataQueryResponse = toDataQueryResponse({
                                    data: data,
                                });
                                var df = [];
                                if (dataQueryResponse.data.length !== 0) {
                                    for (var i = 0; i < dataQueryResponse.data.length; i++) {
                                        for (var j = 0; j < dataQueryResponse.data[i].fields[0].values.length; j++) {
                                            df.push({
                                                annotation: annotation,
                                                time: Date.parse(dataQueryResponse.data[i].fields[0].values.get(j)),
                                                title: dataQueryResponse.data[i].fields[1].values.get(j),
                                                tags: [],
                                                text: dataQueryResponse.data[i].fields[3].values.get(j),
                                            });
                                        }
                                    }
                                }
                                return df;
                            })))];
                }
            });
        });
    };
    CloudMonitoringDatasource.prototype.applyTemplateVariables = function (_a, scopedVars) {
        var metricQuery = _a.metricQuery, refId = _a.refId, queryType = _a.queryType, sloQuery = _a.sloQuery;
        return {
            datasourceId: this.id,
            refId: refId,
            intervalMs: this.intervalMs,
            type: 'timeSeriesQuery',
            queryType: queryType,
            metricQuery: __assign(__assign({}, this.interpolateProps(metricQuery, scopedVars)), { projectName: this.templateSrv.replace(metricQuery.projectName ? metricQuery.projectName : this.getDefaultProject(), scopedVars), filters: this.interpolateFilters(metricQuery.filters || [], scopedVars), groupBys: this.interpolateGroupBys(metricQuery.groupBys || [], scopedVars), view: metricQuery.view || 'FULL', editorMode: metricQuery.editorMode }),
            sloQuery: sloQuery && this.interpolateProps(sloQuery, scopedVars),
        };
    };
    CloudMonitoringDatasource.prototype.getLabels = function (metricType, refId, projectName, groupBys) {
        return __awaiter(this, void 0, void 0, function () {
            var options, queries;
            var _this = this;
            return __generator(this, function (_a) {
                options = {
                    targets: [
                        {
                            refId: refId,
                            datasourceId: this.id,
                            queryType: QueryType.METRICS,
                            metricQuery: {
                                projectName: this.templateSrv.replace(projectName),
                                metricType: this.templateSrv.replace(metricType),
                                groupBys: this.interpolateGroupBys(groupBys || [], {}),
                                crossSeriesReducer: 'REDUCE_NONE',
                                view: 'HEADERS',
                            },
                        },
                    ],
                    range: this.timeSrv.timeRange(),
                };
                queries = options.targets;
                if (!queries.length) {
                    return [2 /*return*/, lastValueFrom(of({ results: [] }))];
                }
                return [2 /*return*/, lastValueFrom(from(this.ensureGCEDefaultProject()).pipe(mergeMap(function () {
                        return _this.api.post({
                            from: options.range.from.valueOf().toString(),
                            to: options.range.to.valueOf().toString(),
                            queries: queries,
                        });
                    }), map(function (_a) {
                        var _b, _c, _d, _e;
                        var data = _a.data;
                        var dataQueryResponse = toDataQueryResponse({
                            data: data,
                        });
                        return (_e = (_d = (_c = (_b = dataQueryResponse === null || dataQueryResponse === void 0 ? void 0 : dataQueryResponse.data[0]) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.labels) !== null && _e !== void 0 ? _e : {};
                    })))];
            });
        });
    };
    CloudMonitoringDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var status, message, defaultErrorMessage, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        defaultErrorMessage = 'Cannot connect to Google Cloud Monitoring API';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        return [4 /*yield*/, this.ensureGCEDefaultProject()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.api.test(this.getDefaultProject())];
                    case 3:
                        response = _a.sent();
                        if (response.status === 200) {
                            status = 'success';
                            message = 'Successfully queried the Google Cloud Monitoring API.';
                        }
                        else {
                            status = 'error';
                            message = response.statusText ? response.statusText : defaultErrorMessage;
                        }
                        return [3 /*break*/, 6];
                    case 4:
                        error_1 = _a.sent();
                        status = 'error';
                        if (isString(error_1)) {
                            message = error_1;
                        }
                        else {
                            message = 'Google Cloud Monitoring: ';
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
    CloudMonitoringDatasource.prototype.getGCEDefaultProject = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, lastValueFrom(this.api
                        .post({
                        queries: [
                            {
                                refId: 'getGCEDefaultProject',
                                type: 'getGCEDefaultProject',
                                datasourceId: this.id,
                            },
                        ],
                    })
                        .pipe(map(function (_a) {
                        var _b, _c, _d, _e;
                        var data = _a.data;
                        var dataQueryResponse = toDataQueryResponse({
                            data: data,
                        });
                        return (_e = (_d = (_c = (_b = dataQueryResponse === null || dataQueryResponse === void 0 ? void 0 : dataQueryResponse.data[0]) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.defaultProject) !== null && _e !== void 0 ? _e : '';
                    }), catchError(function (err) {
                        return throwError(err.data.error);
                    })))];
            });
        });
    };
    CloudMonitoringDatasource.prototype.getDefaultProject = function () {
        var _a = this.instanceSettings.jsonData, defaultProject = _a.defaultProject, authenticationType = _a.authenticationType, gceDefaultProject = _a.gceDefaultProject;
        if (authenticationType === 'gce') {
            return gceDefaultProject || '';
        }
        return defaultProject || '';
    };
    CloudMonitoringDatasource.prototype.ensureGCEDefaultProject = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, authenticationType, gceDefaultProject, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this.instanceSettings.jsonData, authenticationType = _a.authenticationType, gceDefaultProject = _a.gceDefaultProject;
                        if (!(authenticationType === 'gce' && !gceDefaultProject)) return [3 /*break*/, 2];
                        _b = this.instanceSettings.jsonData;
                        return [4 /*yield*/, this.getGCEDefaultProject()];
                    case 1:
                        _b.gceDefaultProject = _c.sent();
                        _c.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    CloudMonitoringDatasource.prototype.getMetricTypes = function (projectName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!projectName) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, this.api.get(this.templateSrv.replace(projectName) + "/metricDescriptors", {
                        responseMap: function (m) {
                            var _a = __read(m.type.split('/'), 1), service = _a[0];
                            var _b = __read(service.split('.'), 1), serviceShortName = _b[0];
                            m.service = service;
                            m.serviceShortName = serviceShortName;
                            m.displayName = m.displayName || m.type;
                            return m;
                        },
                    })];
            });
        });
    };
    CloudMonitoringDatasource.prototype.getSLOServices = function (projectName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.api.get(this.templateSrv.replace(projectName) + "/services?pageSize=1000", {
                        responseMap: function (_a) {
                            var name = _a.name, displayName = _a.displayName;
                            return ({
                                value: name.match(/([^\/]*)\/*$/)[1],
                                label: displayName || name.match(/([^\/]*)\/*$/)[1],
                            });
                        },
                    })];
            });
        });
    };
    CloudMonitoringDatasource.prototype.getServiceLevelObjectives = function (projectName, serviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, p, s;
            return __generator(this, function (_b) {
                if (!serviceId) {
                    return [2 /*return*/, Promise.resolve([])];
                }
                _a = this.interpolateProps({ projectName: projectName, serviceId: serviceId }), p = _a.projectName, s = _a.serviceId;
                return [2 /*return*/, this.api.get(p + "/services/" + s + "/serviceLevelObjectives", {
                        responseMap: function (_a) {
                            var name = _a.name, displayName = _a.displayName, goal = _a.goal;
                            return ({
                                value: name.match(/([^\/]*)\/*$/)[1],
                                label: displayName,
                                goal: goal,
                            });
                        },
                    })];
            });
        });
    };
    CloudMonitoringDatasource.prototype.getProjects = function () {
        return this.api.get("projects", {
            responseMap: function (_a) {
                var projectId = _a.projectId, name = _a.name;
                return ({
                    value: projectId,
                    label: name,
                });
            },
            baseUrl: this.instanceSettings.url + "/cloudresourcemanager/v1/",
        });
    };
    CloudMonitoringDatasource.prototype.migrateQuery = function (query) {
        if (!query.hasOwnProperty('metricQuery')) {
            var _a = query, hide = _a.hide, refId = _a.refId, datasource = _a.datasource, key = _a.key, queryType = _a.queryType, maxLines = _a.maxLines, metric = _a.metric, intervalMs = _a.intervalMs, type = _a.type, rest = __rest(_a, ["hide", "refId", "datasource", "key", "queryType", "maxLines", "metric", "intervalMs", "type"]);
            return {
                refId: refId,
                intervalMs: intervalMs,
                type: type,
                hide: hide,
                queryType: QueryType.METRICS,
                metricQuery: __assign(__assign({}, rest), { view: rest.view || 'FULL' }),
            };
        }
        return query;
    };
    CloudMonitoringDatasource.prototype.interpolateProps = function (object, scopedVars) {
        var _this = this;
        if (scopedVars === void 0) { scopedVars = {}; }
        return Object.entries(object).reduce(function (acc, _a) {
            var _b;
            var _c = __read(_a, 2), key = _c[0], value = _c[1];
            return __assign(__assign({}, acc), (_b = {}, _b[key] = value && isString(value) ? _this.templateSrv.replace(value, scopedVars) : value, _b));
        }, {});
    };
    CloudMonitoringDatasource.prototype.filterQuery = function (query) {
        if (query.hide) {
            return false;
        }
        if (query.queryType && query.queryType === QueryType.SLO && query.sloQuery) {
            var _a = query.sloQuery, selectorName = _a.selectorName, serviceId = _a.serviceId, sloId = _a.sloId, projectName = _a.projectName;
            return !!selectorName && !!serviceId && !!sloId && !!projectName;
        }
        if (query.queryType && query.queryType === QueryType.METRICS && query.metricQuery.editorMode === EditorMode.MQL) {
            return !!query.metricQuery.projectName && !!query.metricQuery.query;
        }
        var metricType = query.metricQuery.metricType;
        return !!metricType;
    };
    CloudMonitoringDatasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        return queries.map(function (query) { return _this.applyTemplateVariables(_this.migrateQuery(query), scopedVars); });
    };
    CloudMonitoringDatasource.prototype.interpolateFilters = function (filters, scopedVars) {
        var _this = this;
        var completeFilter = chunk(filters, 4)
            .map(function (_a) {
            var _b = __read(_a, 4), key = _b[0], operator = _b[1], value = _b[2], condition = _b[3];
            return (__assign({ key: key, operator: operator, value: value }, (condition && { condition: condition })));
        })
            .filter(function (item) { return item.value; });
        var filterArray = flatten(completeFilter.map(function (_a) {
            var key = _a.key, operator = _a.operator, value = _a.value, condition = _a.condition;
            return __spreadArray([
                _this.templateSrv.replace(key, scopedVars || {}),
                operator,
                _this.templateSrv.replace(value, scopedVars || {}, 'regex')
            ], __read((condition ? [condition] : [])), false);
        }));
        return filterArray || [];
    };
    CloudMonitoringDatasource.prototype.interpolateGroupBys = function (groupBys, scopedVars) {
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
    return CloudMonitoringDatasource;
}(DataSourceWithBackend));
export default CloudMonitoringDatasource;
//# sourceMappingURL=datasource.js.map