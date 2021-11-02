import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { from, merge, of } from 'rxjs';
import { DataSourceWithBackend, getBackendSrv, getGrafanaLiveSrv, getTemplateSrv } from '@grafana/runtime';
import { DataFrameView, isValidLiveChannelAddress, parseLiveChannelAddress, toDataFrame, } from '@grafana/data';
import { GrafanaAnnotationType, GrafanaQueryType } from './types';
import AnnotationQueryEditor from './components/AnnotationQueryEditor';
import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { isString } from 'lodash';
import { migrateDatasourceNameToRef } from 'app/features/dashboard/state/DashboardMigrator';
import { map } from 'rxjs/operators';
var counter = 100;
var GrafanaDatasource = /** @class */ (function (_super) {
    __extends(GrafanaDatasource, _super);
    function GrafanaDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.annotations = {
            QueryEditor: AnnotationQueryEditor,
            prepareAnnotation: function (json) {
                var _a, _b, _c, _d, _e;
                // Previously, these properties lived outside of target
                // This should handle migrating them
                json.target = (_a = json.target) !== null && _a !== void 0 ? _a : {
                    type: (_b = json.type) !== null && _b !== void 0 ? _b : GrafanaAnnotationType.Dashboard,
                    limit: (_c = json.limit) !== null && _c !== void 0 ? _c : 100,
                    tags: (_d = json.tags) !== null && _d !== void 0 ? _d : [],
                    matchAny: (_e = json.matchAny) !== null && _e !== void 0 ? _e : false,
                }; // using spread syntax caused an infinite loop in StandardAnnotationQueryEditor
                return json;
            },
            prepareQuery: function (anno) {
                var datasource = undefined;
                if (isString(anno.datasource)) {
                    var ref = migrateDatasourceNameToRef(anno.datasource);
                    if (ref) {
                        datasource = ref;
                    }
                }
                else {
                    datasource = anno.datasource;
                }
                return __assign(__assign({}, anno), { refId: anno.name, queryType: GrafanaQueryType.Annotations, datasource: datasource });
            },
        };
        return _this;
    }
    GrafanaDatasource.prototype.query = function (request) {
        var e_1, _a;
        var _b, _c;
        var results = [];
        var targets = [];
        var templateSrv = getTemplateSrv();
        try {
            for (var _d = __values(request.targets), _e = _d.next(); !_e.done; _e = _d.next()) {
                var target = _e.value;
                if (target.queryType === GrafanaQueryType.Annotations) {
                    return from(this.getAnnotations({
                        range: request.range,
                        rangeRaw: request.range.raw,
                        annotation: target,
                        dashboard: getDashboardSrv().getCurrent(),
                    }));
                }
                if (target.hide) {
                    continue;
                }
                if (target.queryType === GrafanaQueryType.LiveMeasurements) {
                    var channel = templateSrv.replace(target.channel, request.scopedVars);
                    var filter = target.filter;
                    // Help migrate pre-release channel paths saved in dashboards
                    // NOTE: this should be removed before V8 is released
                    if (channel && channel.startsWith('telegraf/')) {
                        channel = 'stream/' + channel;
                        target.channel = channel; // mutate the current query object so it is saved with `stream/` prefix
                    }
                    var addr = parseLiveChannelAddress(channel);
                    if (!isValidLiveChannelAddress(addr)) {
                        continue;
                    }
                    var buffer = {
                        maxLength: (_b = request.maxDataPoints) !== null && _b !== void 0 ? _b : 500,
                    };
                    if (target.buffer) {
                        buffer.maxDelta = target.buffer;
                        buffer.maxLength = buffer.maxLength * 2; //??
                    }
                    else if (((_c = request.rangeRaw) === null || _c === void 0 ? void 0 : _c.to) === 'now') {
                        buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
                    }
                    results.push(getGrafanaLiveSrv().getDataStream({
                        key: request.requestId + "." + counter++,
                        addr: addr,
                        filter: filter,
                        buffer: buffer,
                    }));
                }
                else {
                    if (!target.queryType) {
                        target.queryType = GrafanaQueryType.RandomWalk;
                    }
                    targets.push(target);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (targets.length) {
            results.push(_super.prototype.query.call(this, __assign(__assign({}, request), { targets: targets })));
        }
        if (results.length) {
            // With a single query just return the results
            if (results.length === 1) {
                return results[0];
            }
            return merge.apply(void 0, __spreadArray([], __read(results), false));
        }
        return of(); // nothing
    };
    GrafanaDatasource.prototype.listFiles = function (path) {
        return this.query({
            targets: [
                {
                    refId: 'A',
                    queryType: GrafanaQueryType.List,
                    path: path,
                },
            ],
        }).pipe(map(function (v) {
            var _a;
            var frame = (_a = v.data[0]) !== null && _a !== void 0 ? _a : toDataFrame({});
            return new DataFrameView(frame);
        }));
    };
    GrafanaDatasource.prototype.metricFindQuery = function (options) {
        return Promise.resolve([]);
    };
    GrafanaDatasource.prototype.getAnnotations = function (options) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var templateSrv, annotation, target, params, delimiter_1, tags, _b, _c, t, renderedValues, _d, _e, tt, annotations;
            var e_2, _f, e_3, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        templateSrv = getTemplateSrv();
                        annotation = options.annotation;
                        target = annotation.target;
                        params = {
                            from: options.range.from.valueOf(),
                            to: options.range.to.valueOf(),
                            limit: target.limit,
                            tags: target.tags,
                            matchAny: target.matchAny,
                        };
                        if (target.type === GrafanaAnnotationType.Dashboard) {
                            // if no dashboard id yet return
                            if (!options.dashboard.id) {
                                return [2 /*return*/, Promise.resolve({ data: [] })];
                            }
                            // filter by dashboard id
                            params.dashboardId = options.dashboard.id;
                            // remove tags filter if any
                            delete params.tags;
                        }
                        else {
                            // require at least one tag
                            if (!Array.isArray(target.tags) || target.tags.length === 0) {
                                return [2 /*return*/, Promise.resolve({ data: [] })];
                            }
                            delimiter_1 = '__delimiter__';
                            tags = [];
                            try {
                                for (_b = __values(params.tags), _c = _b.next(); !_c.done; _c = _b.next()) {
                                    t = _c.value;
                                    renderedValues = templateSrv.replace(t, {}, function (value) {
                                        if (typeof value === 'string') {
                                            return value;
                                        }
                                        return value.join(delimiter_1);
                                    });
                                    try {
                                        for (_d = (e_3 = void 0, __values(renderedValues.split(delimiter_1))), _e = _d.next(); !_e.done; _e = _d.next()) {
                                            tt = _e.value;
                                            tags.push(tt);
                                        }
                                    }
                                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                                    finally {
                                        try {
                                            if (_e && !_e.done && (_g = _d.return)) _g.call(_d);
                                        }
                                        finally { if (e_3) throw e_3.error; }
                                    }
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (_c && !_c.done && (_f = _b.return)) _f.call(_b);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                            params.tags = tags;
                        }
                        return [4 /*yield*/, getBackendSrv().get('/api/annotations', params, "grafana-data-source-annotations-" + annotation.name + "-" + ((_a = options.dashboard) === null || _a === void 0 ? void 0 : _a.id))];
                    case 1:
                        annotations = _h.sent();
                        return [2 /*return*/, { data: [toDataFrame(annotations)] }];
                }
            });
        });
    };
    GrafanaDatasource.prototype.testDatasource = function () {
        return Promise.resolve();
    };
    return GrafanaDatasource;
}(DataSourceWithBackend));
export { GrafanaDatasource };
//# sourceMappingURL=datasource.js.map